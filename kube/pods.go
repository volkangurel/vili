package kube

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strings"

	"github.com/airware/vili/kube/extensions/v1beta1"
	"github.com/airware/vili/kube/unversioned"
	"github.com/airware/vili/kube/v1"
	"github.com/airware/vili/log"
)

// Pods is the default pods service instance
var Pods = new(PodsService)

// PodsService is the kubernetes service to interace with pods
type PodsService struct {
}

// List fetches the list of pods in `env`
func (s *PodsService) List(env string, query *url.Values) (*v1.PodList, *unversioned.Status, error) {
	client, err := getClient(env)
	if err != nil {
		return nil, nil, invalidEnvError(env)
	}
	resp := new(v1.PodList)
	status, err := client.unmarshalRequest("GET", "pods", query, nil, resp)
	if status != nil || err != nil {
		return nil, status, err
	}
	return resp, nil, nil
}

// ListForController fetches the list of pods in `env` for the given controller
func (s *PodsService) ListForController(env string, controller *v1.ReplicationController) (*v1.PodList, *unversioned.Status, error) {
	var selector []string
	for k, v := range controller.Spec.Selector {
		selector = append(selector, fmt.Sprintf("%s=%s", k, v))
	}
	query := new(url.Values)
	query.Add("labelSelector", strings.Join(selector, ","))
	return s.List(env, query)
}

// ListForReplicaSet fetches the list of pods in `env` for the given replicaset
func (s *PodsService) ListForReplicaSet(env string, replicaSet *v1beta1.ReplicaSet) (*v1.PodList, *unversioned.Status, error) {
	var selector []string
	for k, v := range replicaSet.Spec.Selector.MatchLabels {
		selector = append(selector, fmt.Sprintf("%s=%s", k, v))
	}
	query := new(url.Values)
	query.Add("labelSelector", strings.Join(selector, ","))
	return s.List(env, query)
}

// ListForDeployment fetches the list of pods in `env` for the given deployment
func (s *PodsService) ListForDeployment(env string, deployment *v1beta1.Deployment) (*v1.PodList, *unversioned.Status, error) {
	var selector []string
	for k, v := range deployment.Spec.Selector.MatchLabels {
		selector = append(selector, fmt.Sprintf("%s=%s", k, v))
	}
	query := new(url.Values)
	query.Add("labelSelector", strings.Join(selector, ","))
	return s.List(env, query)
}

// Get fetches the pod in `env` with `name`
func (s *PodsService) Get(env, name string) (*v1.Pod, *unversioned.Status, error) {
	client, err := getClient(env)
	if err != nil {
		return nil, nil, invalidEnvError(env)
	}
	resp := new(v1.Pod)
	status, err := client.unmarshalRequest("GET", "pods/"+name, nil, nil, resp)
	if status != nil || err != nil {
		return nil, status, err
	}
	return resp, nil, nil
}

// GetLog fetches the pod log in `env` with `name`
func (s *PodsService) GetLog(env, name string) (string, *unversioned.Status, error) {
	client, err := getClient(env)
	if err != nil {
		return "", nil, invalidEnvError(env)
	}
	body, status, err := client.getRequestBytes("GET", "pods/"+name+"/log", nil, nil)
	if status != nil || err != nil {
		return "", status, err
	}
	return string(body), nil, nil
}

// Create creates a pod in `env`
func (s *PodsService) Create(env string, data *v1.Pod) (*v1.Pod, *unversioned.Status, error) {
	client, err := getClient(env)
	if err != nil {
		return nil, nil, invalidEnvError(env)
	}
	dataBytes, err := json.Marshal(data)
	if err != nil {
		return nil, nil, err
	}
	resp := new(v1.Pod)
	status, err := client.unmarshalRequest(
		"POST",
		"pods",
		nil,
		bytes.NewReader(dataBytes),
		resp,
	)
	if status != nil || err != nil {
		return nil, status, err
	}
	return resp, nil, nil
}

// Delete deletes the pod in `env` with `name`
func (s *PodsService) Delete(env, name string) (*v1.Pod, *unversioned.Status, error) {
	client, err := getClient(env)
	if err != nil {
		return nil, nil, invalidEnvError(env)
	}
	resp := new(v1.Pod)
	status, err := client.unmarshalRequest("DELETE", "pods/"+name, nil, nil, resp)
	if status != nil || err != nil {
		return nil, status, err
	}
	return resp, nil, nil
}

// DeleteForController deletes the pods in `env` for the given controller
func (s *PodsService) DeleteForController(env string, controller *v1.ReplicationController) (*v1.PodList, *unversioned.Status, error) {
	client, err := getClient(env)
	if err != nil {
		return nil, nil, invalidEnvError(env)
	}

	podList, status, err := s.ListForController(env, controller)
	if status != nil || err != nil {
		return nil, status, err
	}
	for _, pod := range podList.Items {
		resp := new(v1.Pod)
		status, err := client.unmarshalRequest("DELETE", "pods/"+pod.ObjectMeta.Name, nil, nil, resp)
		if status != nil || err != nil {
			return nil, status, err
		}
	}
	return podList, nil, nil
}

// PodEvent describes an event on a pod
type PodEvent struct {
	Type   string  `json:"type"`
	Object *v1.Pod `json:"object"`
}

// Watch watches the list of pods in `env`
func (s *PodsService) Watch(env string, query *url.Values, eventChan chan<- *PodEvent, stopChan chan struct{}) error {
	client, err := getClient(env)
	if err != nil {
		return invalidEnvError(env)
	}
	if query == nil {
		query = &url.Values{}
	}
	if query.Get("resourceVersion") == "" {
		// get the current pods first
		pods := new(v1.PodList)
		status, err := client.unmarshalRequest("GET", "pods", query, nil, pods)
		if err != nil {
			return err
		}
		if status != nil {
			return errors.New(status.Message)
		}
		for _, pod := range pods.Items {
			p := pod
			eventChan <- &PodEvent{
				Type:   "INIT",
				Object: &p,
			}
		}
		query.Set("resourceVersion", pods.ListMeta.ResourceVersion)
	}
	log.Infof("subscribing to pod events - %s - %v", env, query)
	// then watch for events starting from the resource version
	return client.streamWatchRequest("pods", query, func(eventType string, body json.RawMessage) error {
		event := &PodEvent{
			Type:   eventType,
			Object: new(v1.Pod),
		}
		err = json.Unmarshal(body, event.Object)
		if err != nil {
			return err
		}
		eventChan <- event
		return nil
	}, stopChan)
}
