package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/airware/vili/config"
	"github.com/airware/vili/docker"
	"github.com/airware/vili/errors"
	"github.com/airware/vili/kube"
	"github.com/airware/vili/kube/extensions/v1beta1"
	"github.com/airware/vili/log"
	"github.com/airware/vili/server"
	"github.com/airware/vili/session"
	"github.com/airware/vili/templates"
	"github.com/airware/vili/util"
	echo "gopkg.in/labstack/echo.v1"
)

const (
	jobRunTimeout    = 5 * time.Minute
	jobRunPollPeriod = 1 * time.Second
)

func jobRunCreateHandler(c *echo.Context) error {
	env := c.Param("env")
	jobName := c.Param("job")

	jobRun := new(JobRun)
	if err := json.NewDecoder(c.Request().Body).Decode(jobRun); err != nil {
		return err
	}
	if jobRun.Branch == "" {
		return server.ErrorResponse(c, errors.BadRequest("Request missing branch"))
	}
	if jobRun.Tag == "" {
		return server.ErrorResponse(c, errors.BadRequest("Request missing tag"))
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
			return server.ErrorResponse(c, errors.BadRequest(e.Error()))
		default:
			return e
		}
	}
	return c.JSON(http.StatusOK, jobRun)
}

// JobRun represents a single pod run
type JobRun struct {
	ID       string    `json:"id"`
	Env      string    `json:"env"`
	JobName  string    `json:"jobName"`
	Branch   string    `json:"branch"`
	Tag      string    `json:"tag"`
	Time     time.Time `json:"time"`
	Username string    `json:"username"`

	Job *v1beta1.Job `json:"job"`
}

// Init initializes a pod, checks to make sure it is valid, and runs it
func (r *JobRun) Init(env, jobName, username string, async bool) error {
	r.ID = util.RandLowercaseString(16)
	r.Env = env
	r.JobName = jobName
	r.Time = time.Now()
	r.Username = username

	digest, err := docker.GetTag(jobName, r.Branch, r.Tag)
	if err != nil {
		return err
	}
	if digest == "" {
		return JobRunInitError{
			message: fmt.Sprintf("Tag %s not found for job %s", r.Tag, jobName),
		}
	}

	err = r.createNewJob()
	if err != nil {
		return err
	}

	if async {
		go r.watchJob()
		return nil
	}
	return r.watchJob()
}

func (r *JobRun) createNewJob() (err error) {
	// get the spec
	jobTemplate, err := templates.Job(r.Env, r.Branch, r.JobName)
	if err != nil {
		return
	}

	job := new(v1beta1.Job)
	err = jobTemplate.Parse(job)
	if err != nil {
		return
	}

	containers := job.Spec.Template.Spec.Containers
	if len(containers) == 0 {
		return fmt.Errorf("no containers in job")
	}

	imageName, err := docker.FullName(r.JobName, r.Branch, r.Tag)
	if err != nil {
		return
	}
	containers[0].Image = imageName

	job.ObjectMeta.Name = r.JobName + "-" + r.ID
	job.ObjectMeta.Labels = map[string]string{
		"job":       r.JobName,
		"startedBy": r.Username,
	}

	newJob, status, err := kube.Jobs.Create(r.Env, job)
	if err != nil {
		return
	}
	if status != nil {
		return fmt.Errorf(status.Message)
	}
	r.Job = newJob
	r.logMessage(fmt.Sprintf("Job for tag %s and branch %s created by %s", r.Tag, r.Branch, r.Username), log.InfoLevel)
	return
}

// watchJob waits until the job exits
func (r *JobRun) watchJob() error {
	stopChan := make(chan struct{})
	eventChan := make(chan *kube.JobEvent)
	defer close(eventChan)

	startTime := time.Now()
	go func() {
		for jobEvent := range eventChan {
			switch jobEvent.Type {
			case kube.WatchEventDeleted:
				elapsed := time.Now().Sub(startTime)
				r.logMessage(fmt.Sprintf("Deleted job after %s", humanizeDuration(elapsed)), log.WarnLevel)
				close(stopChan)
			case kube.WatchEventInit, kube.WatchEventAdded, kube.WatchEventModified:
				for _, condition := range jobEvent.Object.Status.Conditions {
					switch condition.Type {
					case v1beta1.JobComplete:
						elapsed := time.Now().Sub(startTime)
						r.logMessage(fmt.Sprintf("Successfully completed job in %s", humanizeDuration(elapsed)), log.InfoLevel)
						close(stopChan)
					case v1beta1.JobFailed:
						elapsed := time.Now().Sub(startTime)
						r.logMessage(fmt.Sprintf("Failed job after %s", humanizeDuration(elapsed)), log.ErrorLevel)
						close(stopChan)

					}
				}
			}
		}
	}()
	// TODO set up timeout

	_, err := kube.Jobs.WatchJob(r.Env, r.Job.ObjectMeta.Name, nil, eventChan, stopChan)
	return err
}

func (r *JobRun) logMessage(message string, level log.Level) {
	urlStr := fmt.Sprintf(
		"%s/%s/jobs/%s/runs/%s",
		config.GetString(config.URI),
		r.Env,
		r.JobName,
		r.Job.ObjectMeta.Name,
	)
	slackMessage := fmt.Sprintf(
		"*%s* - *%s* - <%s|%s> - %s",
		r.Env,
		r.JobName,
		urlStr,
		r.ID,
		message,
	)
	logMessage(message, slackMessage, level)
}

// JobRunInitError is raised if there is a problem initializing a pod
type JobRunInitError struct {
	message string
}

func (e JobRunInitError) Error() string {
	return e.message
}
