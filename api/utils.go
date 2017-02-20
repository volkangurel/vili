package api

import (
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/airware/vili/kube/extensions/v1beta1"
	echo "gopkg.in/labstack/echo.v1"
)

var (
	webSocketCloseMessage = map[string]string{
		"type": "CLOSED",
	}
)

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

func filterQueryFields(c *echo.Context, params []string) *url.Values {
	query := &url.Values{}
	for _, param := range params {
		val := c.Request().URL.Query().Get(param)
		if val != "" {
			query.Add(param, val)
		}
	}
	return query
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

func humanizeDuration(d time.Duration) string {
	return ((d / time.Second) * time.Second).String()
}
