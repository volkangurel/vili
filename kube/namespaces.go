package kube

import (
	"bytes"
	"encoding/json"
	"net/url"

	"github.com/airware/vili/kube/unversioned"
	"github.com/airware/vili/kube/v1"
)

// Namespaces is the default namespaces service instance
var Namespaces = new(NamespacesService)

// NamespacesService is the kubernetes service to interace with namespaces
type NamespacesService struct {
}

// List fetches the list of namespaces
func (s *NamespacesService) List(query *url.Values) (*v1.NamespaceList, *unversioned.Status, error) {
	client, err := getDefaultClient()
	if err != nil {
		return nil, nil, err
	}
	resp := new(v1.NamespaceList)
	status, err := client.unmarshalRequest("GET", "namespaces", query, nil, resp)
	if status != nil || err != nil {
		return nil, status, err
	}
	return resp, nil, nil
}

// Get fetches the namespace with `name`
func (s *NamespacesService) Get(name string) (*v1.Namespace, *unversioned.Status, error) {
	client, err := getDefaultClient()
	if err != nil {
		return nil, nil, err
	}
	resp := new(v1.Namespace)
	status, err := client.unmarshalRequest("GET", "namespaces/"+name, nil, nil, resp)
	if status != nil || err != nil {
		return nil, status, err
	}
	return resp, nil, nil
}

// Create creates a namespace
func (s *NamespacesService) Create(data *v1.Namespace) (*v1.Namespace, *unversioned.Status, error) {
	client, err := getDefaultClient()
	if err != nil {
		return nil, nil, err
	}
	dataBytes, err := json.Marshal(data)
	if err != nil {
		return nil, nil, err
	}
	resp := new(v1.Namespace)
	status, err := client.unmarshalRequest(
		"POST",
		"namespaces",
		nil,
		bytes.NewReader(dataBytes),
		resp,
	)
	if status != nil || err != nil {
		return nil, status, err
	}
	return resp, nil, nil
}

// Delete deletes the namespace with `name`
func (s *NamespacesService) Delete(name string) (*unversioned.Status, error) {
	client, err := getDefaultClient()
	if err != nil {
		return nil, err
	}
	status, err := client.unmarshalRequest("DELETE", "namespaces/"+name, nil, nil, nil)
	if status != nil || err != nil {
		return status, err
	}
	return nil, nil
}
