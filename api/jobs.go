package api

import (
	"fmt"
	"net/http"
	"net/url"
	"sync"

	"github.com/airware/vili/docker"
	"github.com/airware/vili/environments"
	"github.com/airware/vili/kube"
	"github.com/airware/vili/kube/extensions/v1beta1"
	"github.com/airware/vili/log"
	"github.com/airware/vili/templates"
	echo "gopkg.in/labstack/echo.v1"
)

// JobResponse is the response for the jobs endpoint
type JobResponse struct {
	Repository []*docker.Image  `json:"repository,omitempty"`
	JobSpec    string           `json:"jobSpec,omitempty"`
	JobList    *v1beta1.JobList `json:"jobList,omitempty"`
	// RunHistory []*v1.Pod        `json:"runHistory,omitempty"`
}

func jobGetHandler(c *echo.Context) error {
	env := c.Param("env")
	job := c.Param("job")
	queryFields := parseQueryFields(c)

	environment, err := environments.Get(env)
	if err != nil {
		return err
	}

	resp := JobResponse{}
	failed := false

	// repository
	var waitGroup sync.WaitGroup
	if len(queryFields) == 0 || queryFields["repository"] {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			images, err := docker.GetRepository(job, environment.RepositoryBranches())
			if err != nil {
				log.Error(err)
				failed = true
			}
			resp.Repository = images
		}()
	}

	// podSpec
	if len(queryFields) == 0 || queryFields["podSpec"] {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			body, err := templates.Job(environment.Name, environment.Branch, job)
			if err != nil {
				log.Error(err)
				failed = true
			}
			resp.JobSpec = string(body)
		}()
	}

	// runs
	if len(queryFields) == 0 || queryFields["runs"] {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			jobList, _, err := kube.Jobs.List(env, &url.Values{
				"labelSelector": {"job=" + job},
			})
			if err != nil {
				log.Error(err)
				failed = true
				return
			}
			resp.JobList = jobList
		}()
	}

	waitGroup.Wait()
	if failed {
		return fmt.Errorf("failed one of the service calls")
	}

	return c.JSON(http.StatusOK, resp)
}
