package api

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/airware/vili/kube/extensions/v1beta1"
)

// LogMessage is a wrapper for log messages in the db
type LogMessage struct {
	Time    time.Time `json:"time"`
	Message string    `json:"msg"`
	Level   string    `json:"level"`
}

func parseQueryFields(c *echo.Context) map[string]bool {
	queryFields := make(map[string]bool)
	requestFields := c.Request().URL.Query().Get("fields")
	if requestFields != "" {
		for _, field := range strings.Split(requestFields, ",") {
			queryFields[field] = true
		}
	}
	return queryFields
}

func getPortFromDeployment(deployment *v1beta1.Deployment) (int32, error) {
	containers := deployment.Spec.Template.Spec.Containers
	if len(containers) == 0 {
		return 0, fmt.Errorf("no containers in controller")
	}
	ports := containers[0].Ports
	if len(ports) == 0 {
		return 0, fmt.Errorf("no ports in controller")
	}
	return ports[0].ContainerPort, nil
}

func getImageTagFromDeployment(deployment *v1beta1.Deployment) (string, error) {
	containers := deployment.Spec.Template.Spec.Containers
	if len(containers) == 0 {
		return "", fmt.Errorf("no containers in deployment")
	}
	image := containers[0].Image
	imageSplit := strings.Split(image, ":")
	if len(imageSplit) != 2 {
		return "", fmt.Errorf("invalid image: %s", image)
	}
	return imageSplit[1], nil
}

// Clock is a time.Duration struct with custom JSON marshal functions
type Clock time.Duration

// MarshalJSON implements the json.Marshaler interface
func (c *Clock) MarshalJSON() ([]byte, error) {
	return json.Marshal(int64(time.Duration(*c) / time.Millisecond))
}

// UnmarshalJSON implements the json.Unmarshaler interface
func (c *Clock) UnmarshalJSON(b []byte) error {
	var ms int64
	err := json.Unmarshal(b, &ms)
	if err != nil {
		return err
	}
	*c = Clock(time.Duration(ms) * time.Millisecond)
	return nil
}
func (c *Clock) humanize() string {
	if c == nil {
		return "0"
	}
	return ((time.Duration(*c) / time.Second) * time.Second).String()
}
