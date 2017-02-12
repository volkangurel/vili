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
	"github.com/airware/vili/firebase"
	"github.com/airware/vili/kube"
	"github.com/airware/vili/kube/extensions/v1beta1"
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
	rolloutStateNew         = "new"
	rolloutStateRunning     = "running"
	rolloutStatePausing     = "pausing"
	rolloutStatePaused      = "paused"
	rolloutStateRollingback = "rollingback"
	rolloutStateRolledback  = "rolledback"
	rolloutStateCompleted   = "completed"
)

const (
	// rolloutPatchTimeout    = 10 * time.Second
	// rolloutPatchPollPeriod = 1 * time.Second
	// rolloutScaleTimeout    = 3 * time.Minute
	// rolloutScalePollPeriod = 1 * time.Second
	rolloutPollPeriod = 200 * time.Millisecond
)

func rolloutCreateHandler(c *echo.Context) error {
	env := c.Param("env")
	deploymentName := c.Param("deployment")

	rollout := new(Rollout)
	if err := json.NewDecoder(c.Request().Body).Decode(rollout); err != nil {
		return err
	}
	if rollout.Branch == "" {
		return server.ErrorResponse(c, errors.BadRequestError("Request missing branch"))
	}
	if rollout.Tag == "" {
		return server.ErrorResponse(c, errors.BadRequestError("Request missing tag"))
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
			return server.ErrorResponse(c, errors.BadRequestError(e.Error()))
		default:
			return e
		}
	}
	return c.JSON(http.StatusOK, rollout)
}

// func rolloutEditHandler(c *echo.Context) error {
// 	env := c.Param("env")
// 	deploymentName := c.Param("deployment")
// 	rolloutID := c.Param("rollout")

// 	rollout := &Rollout{}
// 	if err := json.NewDecoder(c.Request().Body).Decode(rollout); err != nil {
// 		return err
// 	}
// 	if err := rolloutDB(env, deploymentName, rolloutID).Child("rollout").Set(rollout); err != nil {
// 		return err
// 	}
// 	return c.JSON(http.StatusOK, rollout)
// }

// Rollout represents a single deployment of an image for any app
// TODO: support MaxUnavailable and MaxSurge for rolling updates
type Rollout struct {
	ID         string    `json:"id"`
	Env        string    `json:"env"`
	Deployment string    `json:"deployment"`
	Branch     string    `json:"branch"`
	Tag        string    `json:"tag"`
	Time       time.Time `json:"time"`
	Username   string    `json:"username"`
	State      string    `json:"state"`

	// Clock        *Clock `json:"clock"`
	// OriginalPods []Pod  `json:"originalPods"`
	// FromPods     []Pod  `json:"fromPods"`
	// FromTag      string `json:"fromTag"`
	// FromUID      string `json:"fromUid"`

	// ToPods []Pod  `json:"toPods"`
	// ToUID  string `json:"toUid"`

	db *firego.Firebase // TODO remove firebase
}

// Pod is a summary of the state of a kubernetes pod
type Pod struct {
	Name    string    `json:"name"`
	Created time.Time `json:"created"`
	Phase   string    `json:"phase"`
	Ready   bool      `json:"ready"`
	Host    string    `json:"host"`
}

// Init initializes a deployment, checks to make sure it is valid, and writes the deployment
// data to firebase
func (r *Rollout) Init(env, deploymentName, username string, async bool) error {
	r.ID = util.RandLowercaseString(16)
	r.Env = env
	r.Deployment = deploymentName
	r.Time = time.Now()
	r.Username = username
	r.State = rolloutStateNew
	r.db = rolloutDB(env, deploymentName, r.ID)

	digest, err := docker.GetTag(deploymentName, r.Branch, r.Tag)
	if err != nil {
		return err
	}
	if digest == "" {
		return RolloutInitError{
			message: fmt.Sprintf("Tag %s not found for deployment %s", r.Tag, deploymentName),
		}
	}

	if err = r.db.Set(r); err != nil {
		return err
	}

	fromDeployment, _, err := kube.Deployments.Get(env, deploymentName)
	if err != nil {
		return err
	}

	// if fromDeployment != nil {
	// 	// kubePods, _, err := kube.Pods.ListForDeployment(env, fromDeployment)
	// 	// if err != nil {
	// 	// 	return err
	// 	// }
	// 	// imageTag, err := getImageTagFromDeployment(fromDeployment)
	// 	// if err != nil {
	// 	// 	return err
	// 	// }
	// 	// pods, _, _ := getPodsFromPodList(kubePods)
	// 	// r.OriginalPods = pods
	// 	// r.FromPods = pods
	// 	// r.FromTag = imageTag

	// 	// replicaSetList, _, _ := kube.ReplicaSets.List(env, &url.Values{
	// 	// 	"labelSelector": []string{"app=" + deploymentName},
	// 	// })
	// 	// revision := deployment.ObjectMeta.Annotations["deployment.kubernetes.io/revision"]
	// 	// if replicaSetList != nil {
	// 	// 	for _, replicaSet := range replicaSetList.Items {
	// 	// 		rev := replicaSet.ObjectMeta.Annotations["deployment.kubernetes.io/revision"]
	// 	// 		if rev == revision {
	// 	// 			r.FromUID = string(replicaSet.ObjectMeta.UID)
	// 	// 			break
	// 	// 		}
	// 	// 	}
	// 	// }
	// }

	toDeployment, err := r.createNewDeployment(fromDeployment)
	if err != nil {
		return err
	}

	if !async {
		err = r.watchRollout(toDeployment)
		if err != nil {
			return err
		}
	}

	return nil
}

func (r *Rollout) createNewDeployment(fromDeployment *v1beta1.Deployment) (newDeployment *v1beta1.Deployment, err error) {
	// get the spec
	deploymentTemplate, err := templates.Deployment(r.Env, r.Branch, r.Deployment)
	if err != nil {
		return
	}

	deployment := new(v1beta1.Deployment)
	err = deploymentTemplate.Parse(deployment)
	if err != nil {
		return
	}

	deployment.Spec.Template.ObjectMeta.Labels["rollout"] = r.ID

	imageName, err := docker.FullName(r.Deployment, r.Branch, r.Tag)
	if err != nil {
		return
	}
	deployment.Spec.Template.Spec.Containers[0].Image = imageName

	if fromDeployment != nil {
		*deployment.Spec.Replicas = *fromDeployment.Spec.Replicas
	}

	deployment.Spec.Strategy.Type = v1beta1.RollingUpdateDeploymentStrategyType

	// create/update deployment
	newDeployment, _, err = kube.Deployments.Replace(r.Env, r.Deployment, deployment)
	if err != nil {
		return
	}
	if newDeployment == nil {
		newDeployment, _, err = kube.Deployments.Create(r.Env, deployment)
		if err != nil {
			return
		}
	}

	err = r.addMessage(fmt.Sprintf("Rollout for tag %s and branch %s created by %s", r.Tag, r.Branch, r.Username), "info")
	return
}

func (r *Rollout) watchRollout(deployment *v1beta1.Deployment) (err error) {
	// It can take some time for kubernetes to populate the revision annotation
	// var revision string
	// var ok bool
	for {
		// if revision, ok = newDeployment.ObjectMeta.Annotations["deployment.kubernetes.io/revision"]; ok {
		// 	break
		// }
		if deployment.Generation <= deployment.Status.ObservedGeneration {
			if deployment.Status.UpdatedReplicas == *deployment.Spec.Replicas {
				// TODO log rollout completed message?
				break
			}
			// TODO log rollout waiting to be completed message?
		}
		// TODO log rollout waiting to be updated message?
		time.Sleep(rolloutPollPeriod)
		deployment, _, err = kube.Deployments.Get(r.Env, r.Deployment)
		if err != nil {
			return
		}
	}
	// replicaSetList, _, err := kube.ReplicaSets.ListForDeployment(r.Env, newDeployment)
	// if err != nil || replicaSetList == nil {
	// 	return err
	// }
	// for _, replicaSet := range replicaSetList.Items {
	// 	if string(replicaSet.ObjectMeta.UID) == rollout.FromUID {
	// 		fromReplicaSet = replicaSet
	// 	}
	// 	if string(replicaSet.ObjectMeta.UID) == rollout.ToUID {
	// 		toReplicaSet = replicaSet
	// 	}
	// }

	// TODO watch pods
	return nil
}

func (r *Rollout) addMessage(message, level string) error {
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
			"%s/%s/deployments/%s/rollouts/%s",
			config.GetString(config.URI),
			r.Env,
			r.Deployment,
			r.ID,
		)
		slackMessage := fmt.Sprintf(
			"*%s* - *%s* - <%s|%s> - %s",
			r.Env,
			r.Deployment,
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

func rolloutDB(env, deployment, rolloutID string) *firego.Firebase {
	return firebase.Database().Child(env).Child("deployments").Child(deployment).Child("rollouts").Child(rolloutID)
}

func getPodsFromPodList(kubePodList *v1.PodList) (pods []Pod, readyCount, runningCount int) {
	for _, kubePod := range kubePodList.Items {
		pod := Pod{
			Name:    kubePod.ObjectMeta.Name,
			Created: kubePod.ObjectMeta.CreationTimestamp.Time,
			Phase:   string(kubePod.Status.Phase),
		}
		if kubePod.Status.Phase == v1.PodRunning {
			runningCount++
			pod.Ready = true
			for _, containerStatus := range kubePod.Status.ContainerStatuses {
				if !containerStatus.Ready {
					pod.Ready = false
					break
				}
			}
			if pod.Ready {
				readyCount++
			}
		}
		if kubePod.Status.HostIP != "" {
			pod.Host = kubePod.Status.HostIP
		}
		pods = append(pods, pod)
	}
	return
}

// RolloutInitError is raised if there is a problem initializing a rollout
type RolloutInitError struct {
	message string
}

func (e RolloutInitError) Error() string {
	return e.message
}
