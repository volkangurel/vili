package kube

import (
	"bytes"
	"encoding/json"
	"net/url"

	"github.com/airware/vili/errors"
	"github.com/airware/vili/kube/extensions/v1beta1"
	"github.com/airware/vili/kube/unversioned"
	"github.com/airware/vili/log"
)

// Jobs is the default jobs service instance
var Jobs = new(JobsService)

// JobsService is the kubernetes service to interace with jobs
type JobsService struct {
}

// List fetches the list of jobs in `env`
func (s *JobsService) List(env string, query *url.Values) (*v1beta1.JobList, *unversioned.Status, error) {
	client, err := getClient(env)
	if err != nil {
		return nil, nil, invalidEnvError(env)
	}
	resp := new(v1beta1.JobList)
	status, err := client.unmarshalRequest("GET", "jobs", query, nil, resp)
	if status != nil || err != nil {
		return nil, status, err
	}
	return resp, nil, nil
}

// Get fetches the job in `env` with `name`
func (s *JobsService) Get(env, name string) (*v1beta1.Job, *unversioned.Status, error) {
	client, err := getClient(env)
	if err != nil {
		return nil, nil, invalidEnvError(env)
	}
	resp := new(v1beta1.Job)
	status, err := client.unmarshalRequest("GET", "jobs/"+name, nil, nil, resp)
	if status != nil || err != nil {
		return nil, status, err
	}
	return resp, nil, nil
}

// Create creates a job in `env`
func (s *JobsService) Create(env string, data *v1beta1.Job) (*v1beta1.Job, *unversioned.Status, error) {
	client, err := getClient(env)
	if err != nil {
		return nil, nil, invalidEnvError(env)
	}
	dataBytes, err := json.Marshal(data)
	if err != nil {
		return nil, nil, err
	}
	resp := new(v1beta1.Job)
	status, err := client.unmarshalRequest(
		"POST",
		"jobs",
		nil,
		bytes.NewReader(dataBytes),
		resp,
	)
	if status != nil || err != nil {
		return nil, status, err
	}
	return resp, nil, nil
}

// Delete deletes the job in `env` with `name`
func (s *JobsService) Delete(env, name string) (*unversioned.Status, error) {
	client, err := getClient(env)
	if err != nil {
		return nil, invalidEnvError(env)
	}
	status, err := client.unmarshalRequest("DELETE", "jobs/"+name, nil, nil, nil)
	if status != nil || err != nil {
		return status, err
	}
	return nil, nil
}

// JobEvent describes an event on a job
type JobEvent struct {
	Type   WatchEventType `json:"type"`
	Object *v1beta1.Job   `json:"object"`
}

// Watch watches jobs in `env`
func (s *JobsService) Watch(env string, query *url.Values, eventChan chan<- *JobEvent, stopChan chan struct{}) (bool, error) {
	client, err := getClient(env)
	if err != nil {
		return false, invalidEnvError(env)
	}
	if query == nil {
		query = &url.Values{}
	}
	if query.Get("resourceVersion") == "" {
		// get the current job first
		job := new(v1beta1.Job)
		status, err := client.unmarshalRequest("GET", "jobs", query, nil, job)
		if err != nil {
			return false, err
		}
		if status != nil {
			return false, errors.BadRequest(status.Message)
		}
		eventChan <- &JobEvent{
			Type:   WatchEventInit,
			Object: job,
		}
		query.Set("resourceVersion", job.ObjectMeta.ResourceVersion)
	}
	log.Debugf("subscribing to job events - %s", env)
	// then watch for events starting from the resource version
	return client.jsonStreamWatchRequest("jobs", query, stopChan, func(eventType WatchEventType, body json.RawMessage) error {
		event := &JobEvent{
			Type:   eventType,
			Object: new(v1beta1.Job),
		}
		err = json.Unmarshal(body, event.Object)
		if err != nil {
			log.WithError(err).WithField("body", string(body)).Error("error parsing job json")
			return err
		}
		eventChan <- event
		return nil
	})
}
