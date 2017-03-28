package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
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
	echo "gopkg.in/labstack/echo.v1"
)

func rolloutCreateHandler(c *echo.Context) error {
	env := c.Param("env")
	deploymentName := c.Param("deployment")

	rollout := new(Rollout)
	if err := json.NewDecoder(c.Request().Body).Decode(rollout); err != nil {
		return err
	}
	if rollout.Branch == "" {
		return server.ErrorResponse(c, errors.BadRequest("Request missing branch"))
	}
	if rollout.Tag == "" {
		return server.ErrorResponse(c, errors.BadRequest("Request missing tag"))
	}
	err := rollout.Init(
		env,
		deploymentName,
		c.Get("user").(*session.User).Username,
		c.Request().URL.Query().Get("async") != "",
	)
	if err != nil {
		switch e := err.(type) {
		case RolloutInitError:
			return server.ErrorResponse(c, errors.BadRequest(e.Error()))
		default:
			return e
		}
	}
	return c.JSON(http.StatusOK, rollout)
}

// Rollout represents a single deployment of an image for any app
// TODO: support MaxUnavailable and MaxSurge for rolling updates
type Rollout struct {
	Env            string    `json:"env"`
	DeploymentName string    `json:"deploymentName"`
	Branch         string    `json:"branch"`
	Tag            string    `json:"tag"`
	Time           time.Time `json:"time"`
	Username       string    `json:"username"`
	State          string    `json:"state"`

	FromDeployment *v1beta1.Deployment `json:"fromDeployment"`
	FromRevision   string              `json:"fromRevision"`
	ToDeployment   *v1beta1.Deployment `json:"toDeployment"`
	ToRevision     string              `json:"toRevision"`
}

// Init initializes a deployment, checks to make sure it is valid, and runs it
func (r *Rollout) Init(env, deploymentName, username string, async bool) error {
	r.Env = env
	r.DeploymentName = deploymentName
	r.Time = time.Now()
	r.Username = username

	digest, err := docker.GetTag(deploymentName, r.Branch, r.Tag)
	if err != nil {
		return err
	}
	if digest == "" {
		return RolloutInitError{
			message: fmt.Sprintf("Tag %s not found for deployment %s", r.Tag, deploymentName),
		}
	}

	r.FromDeployment, _, err = kube.Deployments.Get(env, deploymentName)
	if err != nil {
		return err
	}
	if r.FromDeployment != nil {
		if revision, ok := r.FromDeployment.ObjectMeta.Annotations["deployment.kubernetes.io/revision"]; ok {
			r.FromRevision = revision
		}
	}

	err = r.createNewDeployment()
	if err != nil {
		return err
	}

	if async {
		go r.watchRollout()
		return nil
	}

	return r.watchRollout()
}

func (r *Rollout) createNewDeployment() (err error) {
	// get the spec
	deploymentTemplate, err := templates.Deployment(r.Env, r.Branch, r.DeploymentName)
	if err != nil {
		return
	}

	deployment := new(v1beta1.Deployment)
	err = deploymentTemplate.Parse(deployment)
	if err != nil {
		return
	}

	labels := map[string]string{
		"app":        r.DeploymentName,
		"deployedBy": r.Username,
	}
	if r.FromRevision != "" {
		labels["fromRevision"] = r.FromRevision
	}
	deployment.ObjectMeta.Labels = labels
	deployment.Spec.Template.ObjectMeta.Labels = labels

	imageName, err := docker.FullName(r.DeploymentName, r.Branch, r.Tag)
	if err != nil {
		return
	}
	deployment.Spec.Template.Spec.Containers[0].Image = imageName

	if r.FromDeployment != nil {
		*deployment.Spec.Replicas = *r.FromDeployment.Spec.Replicas
	}

	deployment.Spec.Strategy.Type = v1beta1.RollingUpdateDeploymentStrategyType

	// create/update deployment
	r.ToDeployment, _, err = kube.Deployments.Replace(r.Env, r.DeploymentName, deployment)
	if err != nil {
		return
	}
	if r.ToDeployment == nil {
		r.ToDeployment, _, err = kube.Deployments.Create(r.Env, deployment)
		if err != nil {
			return
		}
	}

	// wait for ToDeployment to get revision
	err = r.waitRolloutInit()

	r.logMessage(fmt.Sprintf("Rollout for tag %s and branch %s created by %s", r.Tag, r.Branch, r.Username), log.InfoLevel)
	return
}

func (r *Rollout) waitRolloutInit() (err error) {
	stopChan := make(chan struct{})
	eventChan := make(chan *kube.DeploymentEvent)
	defer close(eventChan)

	go func() {
	eventLoop:
		for deploymentEvent := range eventChan {
			r.ToDeployment = deploymentEvent.Object
			switch deploymentEvent.Type {
			case kube.WatchEventDeleted:
				close(stopChan)
				break eventLoop
			case kube.WatchEventInit, kube.WatchEventAdded, kube.WatchEventModified:
				if revision, ok := r.ToDeployment.ObjectMeta.Annotations["deployment.kubernetes.io/revision"]; ok {
					r.ToRevision = revision
					close(stopChan)
					break eventLoop
				}
			}
		}
	}()
	// TODO set up timeout

	_, err = kube.Deployments.Watch(r.Env, &url.Values{
		"fieldSelector": {"metadata.name=" + r.DeploymentName},
	}, eventChan, stopChan)
	return
}

func (r *Rollout) watchRollout() (err error) {
	stopChan := make(chan struct{})
	eventChan := make(chan *kube.DeploymentEvent)
	defer close(eventChan)

	startTime := time.Now()
	go func() {
	eventLoop:
		for deploymentEvent := range eventChan {
			elapsed := time.Now().Sub(startTime)
			deployment := deploymentEvent.Object
			switch deploymentEvent.Type {
			case kube.WatchEventDeleted:
				r.logMessage(fmt.Sprintf("Deleted deployment after %s", humanizeDuration(elapsed)), log.WarnLevel)
				close(stopChan)
				break eventLoop
			case kube.WatchEventInit, kube.WatchEventAdded, kube.WatchEventModified:
				if deployment.Generation <= deployment.Status.ObservedGeneration {
					replicas := *deployment.Spec.Replicas
					if deployment.Status.UpdatedReplicas >= replicas && deployment.Status.AvailableReplicas >= replicas {
						r.logMessage(fmt.Sprintf("Successfully completed rollout in %s", humanizeDuration(elapsed)), log.InfoLevel)
						close(stopChan)
						break eventLoop
					}
				}
			}
		}
	}()
	// TODO set up timeout

	_, err = kube.Deployments.Watch(r.Env, &url.Values{
		"fieldSelector": {"metadata.name=" + r.DeploymentName},
	}, eventChan, stopChan)
	return
}

func (r *Rollout) logMessage(message string, level log.Level) {
	urlStr := fmt.Sprintf(
		"%s/%s/deployments/%s/rollouts/%s", // TODO fix url (ID should be the rollout version)
		config.GetString(config.URI),
		r.Env,
		r.DeploymentName,
		r.ToRevision,
	)
	slackMessage := fmt.Sprintf(
		"*%s* - *%s* - <%s|%s> - %s",
		r.Env,
		r.DeploymentName,
		urlStr,
		r.ToRevision,
		message,
	)
	logMessage(message, slackMessage, level)
}

// RolloutInitError is raised if there is a problem initializing a rollout
type RolloutInitError struct {
	message string
}

func (e RolloutInitError) Error() string {
	return e.message
}
