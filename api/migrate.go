package api

import (
	"fmt"
	"time"

	"github.com/CloudCom/firego"
	"github.com/airware/vili/config"
	"github.com/airware/vili/docker"
	"github.com/airware/vili/errors"
	"github.com/airware/vili/kube"
	"github.com/airware/vili/kube/v1"
	"github.com/airware/vili/log"
	"github.com/airware/vili/redis"
	"github.com/airware/vili/slack"
	"github.com/airware/vili/templates"
)

const (
	migrationTimeout    = 5 * time.Minute
	migrationPollPeriod = 1 * time.Second
)

// migrater
type migraterSpec struct {
	env       string
	migration *Migration
	db        *firego.Firebase

	// for all actions
	pod *v1.Pod

	// for resume
	podTemplate templates.Template
	variables   map[string]string
	lastPing    time.Time
}

func makeMigrater(env string, migration *Migration) (*migraterSpec, error) {
	migrater := &migraterSpec{
		env:       env,
		migration: migration,
		db:        migrationDB(env, migration.ID),
		lastPing:  time.Now(),
	}
	return migrater, nil
}

func (m *migraterSpec) addMessage(message, level string) error {
	var logf func(...interface{})
	switch level {
	case "debug":
		logf = log.Debug
	case "info":
		logf = log.Info
	case "warn":
		logf = log.Warn
	case "error":
		logf = log.Error
	default:
		return fmt.Errorf("Invalid level %s", level)
	}
	logf(message)
	_, err := m.db.Child("log").Push(LogMessage{
		Time:    time.Now(),
		Message: message,
		Level:   level,
	})
	if err != nil {
		return err
	}

	if level != "debug" {
		urlStr := fmt.Sprintf(
			"%s/%s/migrations/%s",
			config.GetString(config.URI),
			m.env,
			m.migration.ID,
		)
		slackMessage := fmt.Sprintf(
			"*%s* - *migrations* - <%s|%s> - %s",
			m.env,
			urlStr,
			m.migration.ID,
			message,
		)
		if level == "error" {
			slackMessage += " <!channel>"
		}
		err := slack.PostLogMessage(slackMessage, level)
		if err != nil {
			return err
		}
	}
	return nil
}

func (m *migraterSpec) start() error {
	log.Infof("Starting migration %s in env %s", m.migration.ID, m.env)

	body, err := templates.Migrations(m.env, m.migration.Branch)
	if err != nil {
		return err
	}
	m.podTemplate = body

	err = m.acquireLock()
	// return any lock errors synchronously
	if err != nil {
		return err
	}

	// if no problem fetching lock, migrate asynchronously
	go func() {
		defer m.releaseLock()

		var state string
		m.db.Child("state").Value(&state)
		var message string
		switch state {
		case migrationStateNew:
			message = fmt.Sprintf("Starting migration created by *%s* for tag *%s*", m.migration.Username, m.migration.Tag)
		default:
			log.Errorf("Cannot resume migration from state %s", state)
			return
		}
		m.db.Child("state").Set(migrationStateRunning)
		m.migration.State = migrationStateRunning
		m.addMessage(message, "info")

		stateNotifications := make(chan firego.Event)
		stateRef := m.db.Child("state")
		if err := stateRef.Watch(stateNotifications); err != nil {
			log.Error(err)
			return
		}
		defer stateRef.StopWatching()
		go func() {
			for event := range stateNotifications {
				log.Debugf("Migration state changed to %s", event.Data.(string))
				m.migration.State = event.Data.(string)
			}
		}()

		// create pod, which starts the job
		pod, err := m.createNewPod()
		if err != nil {
			log.Error(err)
			return
		}
		m.pod = pod
		m.migration.UID = string(pod.ObjectMeta.UID)
		m.db.Child("uid").Set(pod.ObjectMeta.UID)

		// wait for completion
		err = m.waitForPod()
		if err != nil {
			m.db.Child("state").Set(migrationStateTerminated)
			switch e := err.(type) {
			case migraterTerminated:
				m.addMessage("Terminated migration", "warn")
			case migraterTimeout:
				m.addMessage("Migration timed out", "error")
			default:
				m.addMessage(fmt.Sprintf("Unexpected error %s", e), "error")
				log.Error(e)
			}
		}
	}()
	return nil
}

func (m *migraterSpec) terminate() error {
	log.Infof("Terminating migration %s in env %s", m.migration.ID, m.env)
	var state string
	var newState string
	m.db.Child("state").Value(&state)
	var message string
	switch state {
	case migrationStateRunning:
		message = "Pausing migration"
		newState = migrationStateTerminating
	case migrationStateTerminating:
		message = "Force terminating migration"
		newState = migrationStateTerminated
	default:
		return errors.BadRequestError(fmt.Sprintf("Cannot terminate migration from state %s", state))
	}
	m.addMessage(message, "warn")
	m.db.Child("state").Set(newState)
	return nil
}

// utils
func (m *migraterSpec) acquireLock() error {
	locked, err := redis.GetClient().SetNX(
		fmt.Sprintf("migrationslock:%s", m.env),
		true,
		1*time.Hour,
	).Result()
	if err != nil {
		return err
	}
	if !locked {
		return errors.ConflictError("Failed to acquire migrations lock")
	}
	WaitGroup.Add(1)
	return nil
}

func (m *migraterSpec) releaseLock() error {
	WaitGroup.Done()
	return redis.GetClient().Del(
		fmt.Sprintf("migrationslock:%s", m.env),
	).Err()
}

// waitForPod waits until the pod exits
func (m *migraterSpec) waitForPod() error {
	// try to set the number of replicas
	elapsed := 0 * time.Second
	ticker := time.NewTicker(migrationPollPeriod)
	defer ticker.Stop()
WaitLoop:
	for {
		if err := m.ping(); err != nil {
			return err
		}

		pod, _, err := kube.Pods.Get(m.env, m.pod.ObjectMeta.Name)
		if err != nil {
			return err
		}
		if pod != nil {
			log, _, err := kube.Pods.GetLog(m.env, m.pod.ObjectMeta.Name)
			if err != nil {
				return err
			}
			if log != "" {
				m.db.Child("output").Set(log)
			}
			switch pod.Status.Phase {
			case v1.PodSucceeded:
				m.db.Child("state").Set(migrationStateCompleted)
				_, _, err := kube.Pods.Delete(m.env, m.pod.ObjectMeta.Name)
				if err != nil {
					return err
				}
				m.addMessage(fmt.Sprintf("Successfully completed job in %s", m.migration.Clock.humanize()), "info")
				break WaitLoop
			case v1.PodFailed:
				m.db.Child("state").Set(migrationStateFailed)
				m.db.Child("stateReason").Set("Pod failed")
				break WaitLoop
			}
		}

		// tick
		<-ticker.C
		elapsed += migrationPollPeriod
		if elapsed > migrationTimeout {
			return migraterTimeout{}
		}
	}
	return nil
}

// ping updates the migration clock, and checks if the migration should be terminated
func (m *migraterSpec) ping() error {
	now := time.Now()
	elapsed := Clock(now.Sub(m.lastPing))
	if m.migration.Clock == nil {
		m.migration.Clock = &elapsed
	} else {
		*m.migration.Clock += elapsed
	}
	m.lastPing = now
	m.db.Child("clock").Set(m.migration.Clock)

	if m.migration.State == migrationStateTerminating ||
		m.migration.State == migrationStateTerminated {
		return migraterTerminated{}
	}

	select {
	case <-ExitingChan:
		log.Warn("Terminating migration after server shutdown request")
		return migraterTerminated{}
	default:
		return nil
	}
}

func (m *migraterSpec) createNewPod() (*v1.Pod, error) {
	pod := &v1.Pod{}
	err := m.podTemplate.Parse(pod)
	if err != nil {
		return nil, err
	}

	containers := pod.Spec.Containers
	if len(containers) == 0 {
		return nil, fmt.Errorf("no containers in pod")
	}

	imageName, err := docker.FullName(migrationsImageName, m.migration.Branch, m.migration.Tag)
	if err != nil {
		return nil, err
	}
	containers[0].Image = imageName

	pod.ObjectMeta.Name = "migrations-" + m.migration.ID
	pod.ObjectMeta.Labels = map[string]string{
		"job":       "migrations",
		"migration": m.migration.ID,
	}

	resp, status, err := kube.Pods.Create(m.env, pod)
	if status != nil {
		return nil, fmt.Errorf(status.Message)
	}
	return resp, err
}

type migraterException struct {
}

func (e *migraterException) Error() string {
	return "Migrater exception"
}

type migraterTerminated struct {
	*migraterException
}

type migraterTimeout struct {
	*migraterException
}
