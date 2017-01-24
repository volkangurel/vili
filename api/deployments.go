package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"

	"github.com/airware/vili/docker"
	"github.com/airware/vili/environments"
	"github.com/airware/vili/errors"
	"github.com/airware/vili/kube"
	"github.com/airware/vili/kube/extensions/v1beta1"
	"github.com/airware/vili/kube/unversioned"
	"github.com/airware/vili/kube/v1"
	"github.com/airware/vili/log"
	"github.com/airware/vili/server"
	"github.com/airware/vili/templates"
	echo "gopkg.in/labstack/echo.v1"
)

// DeploymentsResponse is the response for the deployments endpoint
type DeploymentsResponse struct {
	Deployments map[string]*DeploymentResponse `json:"deployments,omitempty"`
}

func deploymentsHandler(c *echo.Context) error {
	env := c.Param("env")

	resp := DeploymentsResponse{
		Deployments: make(map[string]*DeploymentResponse),
	}
	failed := false

	// repository
	var waitGroup sync.WaitGroup

	// deployments
	waitGroup.Add(1)
	go func() {
		defer waitGroup.Done()
		deployments, _, err := kube.Deployments.List(env, nil)
		if err != nil {
			log.Error(err)
			failed = true
			return
		}
		var rsMutex sync.Mutex
		for _, deployment := range deployments.Items {
			resp.Deployments[deployment.Name] = new(DeploymentResponse)
			// replica sets for deployment
			waitGroup.Add(1)
			go func(env string, deployment v1beta1.Deployment) {
				defer waitGroup.Done()
				rh, err := getRolloutHistoryForDeployment(env, &deployment)
				if err != nil {
					log.Error(err)
					failed = true
					return
				}
				rs, err := getReplicaSetForDeployment(&deployment, rh)
				if err != nil {
					log.Error(err)
					failed = true
					return
				}
				rsMutex.Lock()
				resp.Deployments[deployment.Name].RolloutHistory = rh
				resp.Deployments[deployment.Name].ReplicaSet = rs
				rsMutex.Unlock()
			}(env, deployment)
		}
	}()

	waitGroup.Wait()
	if failed {
		return fmt.Errorf("failed one of the service calls")
	}

	return c.JSON(http.StatusOK, resp)
}

// DeploymentResponse is the response for the deployment endpoint
type DeploymentResponse struct {
	Repository     []*docker.Image       `json:"repository,omitempty"`
	ReplicaSet     *v1beta1.ReplicaSet   `json:"replicaSet,omitempty"`
	RolloutHistory []*v1beta1.ReplicaSet `json:"rolloutHistory,omitempty"`
	Service        *v1.Service           `json:"service,omitempty"`
	DeploymentSpec string                `json:"deploymentSpec,omitempty"`
}

func deploymentHandler(c *echo.Context) error {
	env := c.Param("env")
	deployment := c.Param("deployment")

	requestFields := c.Request().URL.Query().Get("fields")
	queryFields := make(map[string]bool)
	if requestFields != "" {
		for _, field := range strings.Split(requestFields, ",") {
			queryFields[field] = true
		}
	}

	environment, err := environments.Get(env)
	if err != nil {
		return err
	}

	resp := DeploymentResponse{}
	failed := false

	// repository
	var waitGroup sync.WaitGroup
	if len(queryFields) == 0 || queryFields["repository"] {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			images, err := docker.GetRepository(deployment, environment.RepositoryBranches())
			if err != nil {
				log.Error(err)
				failed = true
			}
			resp.Repository = images
		}()
	}

	// deploymentSpec
	if len(queryFields) == 0 || queryFields["deploymentSpec"] {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			body, err := templates.Deployment(environment.Name, environment.Branch, deployment)
			if err != nil {
				log.Error(err)
				failed = true
			}
			resp.DeploymentSpec = string(body)
		}()
	}

	// deployment
	if len(queryFields) == 0 || queryFields["deployment"] {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			deployment, _, err := kube.Deployments.Get(env, deployment)
			if err != nil {
				log.Error(err)
				failed = true
				return
			}
			if deployment == nil {
				return
			}
			rh, err := getRolloutHistoryForDeployment(env, deployment)
			if err != nil {
				log.Error(err)
				failed = true
				return
			}
			rs, err := getReplicaSetForDeployment(deployment, rh)
			if err != nil {
				log.Error(err)
				failed = true
				return
			}
			resp.RolloutHistory = rh
			resp.ReplicaSet = rs
		}()
	}

	// service
	if len(queryFields) == 0 || queryFields["service"] {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			service, _, err := kube.Services.Get(env, deployment)
			if err != nil {
				log.Error(err)
				failed = true
			}
			resp.Service = service
		}()
	}

	waitGroup.Wait()
	if failed {
		return fmt.Errorf("failed one of the service calls")
	}

	return c.JSON(http.StatusOK, resp)
}

func deploymentCreateServiceHandler(c *echo.Context) error {
	env := c.Param("env")
	deploymentName := c.Param("deployment")

	failed := false

	// repository
	var waitGroup sync.WaitGroup

	var deploymentTemplate templates.Template
	var currentService *v1.Service

	environment, err := environments.Get(env)
	if err != nil {
		return err
	}

	// deploymentTemplate
	waitGroup.Add(1)
	go func() {
		defer waitGroup.Done()
		body, err := templates.Deployment(environment.Name, environment.Branch, deploymentName)
		if err != nil {
			log.Error(err)
			failed = true
		}
		deploymentTemplate = body
	}()

	// service
	waitGroup.Add(1)
	go func() {
		defer waitGroup.Done()
		service, _, err := kube.Services.Get(env, deploymentName)
		if err != nil {
			log.Error(err)
			failed = true
		}
		currentService = service
	}()

	waitGroup.Wait()
	if failed {
		return fmt.Errorf("failed one of the service calls")
	}

	if currentService != nil {
		return server.ErrorResponse(c, errors.ConflictError("Service exists"))
	}
	deployment := &v1beta1.Deployment{}
	deploymentTemplate.Parse(deployment)

	deploymentPort, err := getPortFromDeployment(deployment)
	if err != nil {
		return err
	}

	service := &v1.Service{
		TypeMeta: unversioned.TypeMeta{
			APIVersion: "v1",
		},
		ObjectMeta: v1.ObjectMeta{
			Name: deploymentName,
		},
		Spec: v1.ServiceSpec{
			Ports: []v1.ServicePort{
				v1.ServicePort{
					Protocol: "TCP",
					Port:     deploymentPort,
				},
			},
			Selector: map[string]string{
				"app": deploymentName,
			},
		},
	}

	resp, err := kube.Services.Create(env, deploymentName, service)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, resp)
}

type deploymentActionRequest struct {
	Replicas   *int32 `json:"replicas"`
	ToRevision int64  `json:"toRevision"`
}

const (
	deploymentActionResume   = "resume"
	deploymentActionPause    = "pause"
	deploymentActionRollback = "rollback"
	deploymentActionScale    = "scale"
)

func deploymentActionHandler(c *echo.Context) (err error) {
	env := c.Param("env")
	deploymentName := c.Param("deployment")
	action := c.Param("action")

	_, status, err := kube.Deployments.Get(env, deploymentName)
	if err != nil {
		return err
	}
	if status != nil {
		return server.ErrorResponse(c, errors.BadRequestError(
			fmt.Sprintf("Deployment %s not found", deploymentName)))
	}

	actionRequest := new(deploymentActionRequest)
	// ignore errors, as not all requests have a body
	json.NewDecoder(c.Request().Body).Decode(actionRequest)

	var resp interface{}

	switch action {
	case deploymentActionResume:
		resp, _, err = kube.Deployments.Patch(env, deploymentName, &v1beta1.Deployment{
			Spec: v1beta1.DeploymentSpec{
				Paused: false,
			},
		})
	case deploymentActionPause:
		resp, _, err = kube.Deployments.Patch(env, deploymentName, &v1beta1.Deployment{
			Spec: v1beta1.DeploymentSpec{
				Paused: true,
			},
		})
	case deploymentActionRollback:
		_, _, err = kube.Deployments.Rollback(env, deploymentName, &v1beta1.DeploymentRollback{
			Name: deploymentName,
			RollbackTo: v1beta1.RollbackConfig{
				Revision: actionRequest.ToRevision,
			},
		})
	case deploymentActionScale:
		if actionRequest.Replicas == nil {
			return server.ErrorResponse(c, errors.BadRequestError("Replicas missing from scale request"))
		}
		resp, _, err = kube.Deployments.Patch(env, deploymentName, &v1beta1.Deployment{
			Spec: v1beta1.DeploymentSpec{
				Replicas: actionRequest.Replicas,
				Paused:   false,
			},
		})

	default:
		return server.ErrorResponse(c, errors.NotFoundError(fmt.Sprintf("Action %s not found", action)))
	}
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, resp)
}

func getRolloutHistoryForDeployment(env string, deployment *v1beta1.Deployment) ([]*v1beta1.ReplicaSet, error) {
	replicaSetList, _, err := kube.ReplicaSets.ListForDeployment(env, deployment)
	if err != nil {
		return nil, err
	}
	if replicaSetList == nil {
		return nil, fmt.Errorf("No replicaSet found for deployment %v", *deployment)
	}
	history := byRevision{}
	for _, replicaSet := range replicaSetList.Items {
		rs := replicaSet
		history = append(history, &rs)
	}
	sort.Sort(history)
	return history, nil
}

func getReplicaSetForDeployment(deployment *v1beta1.Deployment, history []*v1beta1.ReplicaSet) (*v1beta1.ReplicaSet, error) {
	deploymentRevision := deployment.ObjectMeta.Annotations["deployment.kubernetes.io/revision"]
	for _, replicaSet := range history {
		rsRevision := replicaSet.ObjectMeta.Annotations["deployment.kubernetes.io/revision"]
		if deploymentRevision == rsRevision {
			return replicaSet, nil
		}
	}
	return nil, fmt.Errorf("No replicaSet found for deployment %v", *deployment)
}

type byRevision []*v1beta1.ReplicaSet

func (s byRevision) Len() int      { return len(s) }
func (s byRevision) Swap(i, j int) { s[i], s[j] = s[j], s[i] }
func (s byRevision) Less(i, j int) bool {
	ri, _ := strconv.Atoi(s[i].ObjectMeta.Annotations["deployment.kubernetes.io/revision"])
	rj, _ := strconv.Atoi(s[j].ObjectMeta.Annotations["deployment.kubernetes.io/revision"])
	return ri > rj
}
