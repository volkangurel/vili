package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/CloudCom/firego"
	"github.com/airware/vili/config"
	"github.com/airware/vili/docker"
	"github.com/airware/vili/errors"
	"github.com/airware/vili/kube"
	"github.com/airware/vili/kube/v1"
	"github.com/airware/vili/log"
	"github.com/airware/vili/server"
	"github.com/airware/vili/session"
	"github.com/airware/vili/slack"
	"github.com/airware/vili/templates"
	"github.com/airware/vili/util"
	echo "gopkg.in/labstack/echo.v1"
)

const (
	jobRunTimeout    = 5 * time.Minute
	jobRunPollPeriod = 1 * time.Second
)

// const (
// 	podActionStart     = "start"
// 	podActionTerminate = "terminate"
// )

// const (
// 	jobRunStateNew         = "new"
// 	jobRunStateRunning     = "running"
// 	jobRunStateTerminating = "terminating"
// 	jobRunStateTerminated  = "terminated"
// 	jobRunStateCompleted   = "completed"
// 	jobRunStateFailed      = "failed"
// )

func jobRunCreateHandler(c *echo.Context) error {
	env := c.Param("env")
	jobName := c.Param("job")

	jobRun := new(JobRun)
	if err := json.NewDecoder(c.Request().Body).Decode(jobRun); err != nil {
		return err
	}
	if jobRun.Branch == "" {
		return server.ErrorResponse(c, errors.BadRequestError("Request missing branch"))
	}
	if jobRun.Tag == "" {
		return server.ErrorResponse(c, errors.BadRequestError("Request missing tag"))
	}

	err := jobRun.Init(
		env,
		jobName,
		c.Get("user").(*session.User).Username,
		c.Request().URL.Query().Get("async") != "",
	)
	if err != nil {
		switch e := err.(type) {
		case JobRunInitError:
			return server.ErrorResponse(c, errors.BadRequestError(e.Error()))
		default:
			return e
		}
	}
	return c.JSON(http.StatusOK, jobRun)
}

// func jobRunActionHandler(c *echo.Context) error {
// 	env := c.Param("env")
// 	jobName := c.Param("job")
// 	runID := c.Param("run")
// 	action := c.Param("action")

// 	pod := &Pod{}
// 	if err := podDB(env, podID).Value(pod); err != nil {
// 		return err
// 	}
// 	if pod.ID == "" {
// 		return server.ErrorResponse(c, errors.NotFoundError("Pod not found"))
// 	}

// 	runner, err := makeRunner(env, pod)
// 	if err != nil {
// 		return err
// 	}
// 	switch action {
// 	case podActionStart:
// 		err = runner.start()
// 	case podActionTerminate:
// 		err = runner.terminate()
// 	default:
// 		return server.ErrorResponse(c, errors.NotFoundError(fmt.Sprintf("Action %s not found", action)))
// 	}
// 	if err != nil {
// 		return err
// 	}
// 	return c.NoContent(http.StatusNoContent)
// }

// JobRun represents a single pod run
type JobRun struct {
	ID       string    `json:"id"`
	Env      string    `json:"env"`
	Job      string    `json:"job"`
	Branch   string    `json:"branch"`
	Tag      string    `json:"tag"`
	Time     time.Time `json:"time"`
	Username string    `json:"username"`
	State    string    `json:"state"`

	// Clock *Clock `json:"clock"`

	// UID string `json:"uid"`

	db *firego.Firebase
}

// Init initializes a pod, checks to make sure it is valid, and writes the run
// data to firebase
func (r *JobRun) Init(env, jobName, username string, async bool) error {
	r.ID = util.RandLowercaseString(16)
	r.Env = env
	r.Job = jobName
	r.Time = time.Now()
	r.Username = username
	// r.State = podStateNew

	digest, err := docker.GetTag(jobName, r.Branch, r.Tag)
	if err != nil {
		return err
	}
	if digest == "" {
		return JobRunInitError{
			message: fmt.Sprintf("Tag %s not found for job %s", r.Tag, jobName),
		}
	}

	// if err = r.db.Set(r); err != nil {
	// 	return err
	// }

	pod, err := r.createNewPod()
	if err != nil {
		return err
	}

	if !async {
		err = r.watchPod()
		if err != nil {
			return err
		}
	}
	return nil
}

// func (m *runnerSpec) terminate() error {
// 	log.Infof("Terminating pod %s in env %s", m.pod.ID, m.env)
// 	var state string
// 	var newState string
// 	m.db.Child("state").Value(&state)
// 	var message string
// 	switch state {
// 	case podStateRunning:
// 		message = "Pausing pod"
// 		newState = podStateTerminating
// 	case podStateTerminating:
// 		message = "Force terminating pod"
// 		newState = podStateTerminated
// 	default:
// 		return errors.BadRequestError(fmt.Sprintf("Cannot terminate pod from state %s", state))
// 	}
// 	m.addMessage(message, "warn")
// 	m.db.Child("state").Set(newState)
// 	return nil
// }

func (r *JobRun) createNewPod() (newPod *v1.Pod, err error) {
	// get the spec
	podTemplate, err := templates.Pod(r.Env, r.Branch, r.Job)
	if err != nil {
		return
	}

	pod := new(v1.Pod)
	err = podTemplate.Parse(pod)
	if err != nil {
		return
	}

	containers := pod.Spec.Containers
	if len(containers) == 0 {
		return nil, fmt.Errorf("no containers in pod")
	}

	imageName, err := docker.FullName(r.Job, r.Branch, r.Tag)
	if err != nil {
		return
	}
	containers[0].Image = imageName

	pod.ObjectMeta.Name = "pods-" + r.ID
	pod.ObjectMeta.Labels = map[string]string{
		"job": r.Job,
		"pod": r.ID,
	}

	newPod, status, err := kube.Pods.Create(r.Env, pod)
	if err != nil {
		return
	}
	if status != nil {
		return nil, fmt.Errorf(status.Message)
	}
	err = r.addMessage(fmt.Sprintf("Pod for tag %s and branch %s created by %s", r.Tag, r.Branch, r.Username), "info")
	return
}

// watchPod waits until the pod exits
func (r *JobRun) watchPod() error {
	// 	elapsed := 0 * time.Second
	// 	ticker := time.NewTicker(podPollPeriod)
	// 	defer ticker.Stop()
	// WaitLoop:
	// 	for {
	// 		if err := m.ping(); err != nil {
	// 			return err
	// 		}

	// 		pod, _, err := kube.Pods.Get(m.env, m.pod.ObjectMeta.Name)
	// 		if err != nil {
	// 			return err
	// 		}
	// 		if pod != nil {
	// 			log, _, err := kube.Pods.GetLog(m.env, m.pod.ObjectMeta.Name)
	// 			if err != nil {
	// 				return err
	// 			}
	// 			if log != "" {
	// 				m.db.Child("output").Set(log)
	// 			}
	// 			switch pod.Status.Phase {
	// 			case v1.PodSucceeded:
	// 				m.db.Child("state").Set(podStateCompleted)
	// 				_, _, err := kube.Pods.Delete(m.env, m.pod.ObjectMeta.Name)
	// 				if err != nil {
	// 					return err
	// 				}
	// 				m.addMessage(fmt.Sprintf("Successfully completed job in %s", m.pod.Clock.humanize()), "info")
	// 				break WaitLoop
	// 			case v1.PodFailed:
	// 				m.db.Child("state").Set(podStateFailed)
	// 				m.db.Child("stateReason").Set("Pod failed")
	// 				break WaitLoop
	// 			}
	// 		}

	// 		// tick
	// 		<-ticker.C
	// 		elapsed += podPollPeriod
	// 		if elapsed > podTimeout {
	// 			return runnerTimeout{}
	// 		}
	// 	}
	return nil
}

func (r *JobRun) addMessage(message, level string) error {
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
	_, err := r.db.Child("log").Push(LogMessage{
		Time:    time.Now(),
		Message: message,
		Level:   level,
	})
	if err != nil {
		return err
	}

	if level != "debug" {
		urlStr := fmt.Sprintf(
			"%s/%s/jobs/%s/runs/%s",
			config.GetString(config.URI),
			r.Env,
			r.Job,
			r.ID,
		)
		slackMessage := fmt.Sprintf(
			"*%s* - *%s* - <%s|%s> - %s",
			r.Env,
			r.Job,
			urlStr,
			r.ID,
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

// // ping updates the pod clock, and checks if the pod should be terminated
// func (m *runnerSpec) ping() error {
// 	now := time.Now()
// 	elapsed := Clock(now.Sub(m.lastPing))
// 	if m.pod.Clock == nil {
// 		m.pod.Clock = &elapsed
// 	} else {
// 		*m.pod.Clock += elapsed
// 	}
// 	m.lastPing = now
// 	m.db.Child("clock").Set(m.pod.Clock)

// 	if m.pod.State == podStateTerminating ||
// 		m.pod.State == podStateTerminated {
// 		return runnerTerminated{}
// 	}

// 	select {
// 	case <-ExitingChan:
// 		log.Warn("Terminating pod after server shutdown request")
// 		return runnerTerminated{}
// 	default:
// 		return nil
// 	}
// }

// type runnerException struct {
// }

// func (e *runnerException) Error() string {
// 	return "Runner exception"
// }

// type runnerTerminated struct {
// 	*runnerException
// }

// type runnerTimeout struct {
// 	*runnerException
// }

// JobRunInitError is raised if there is a problem initializing a pod
type JobRunInitError struct {
	message string
}

func (e JobRunInitError) Error() string {
	return e.message
}
