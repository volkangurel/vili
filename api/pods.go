package api

import (
	"io"
	"net/http"
	"net/url"

	"golang.org/x/net/websocket"

	"github.com/airware/vili/kube"
	"github.com/airware/vili/log"
	echo "gopkg.in/labstack/echo.v1"
)

var podsQueryParams = []string{"labelSelector", "fieldSelector", "resourceVersion"}

func podsHandler(c *echo.Context) error {
	env := c.Param("env")
	query := filterQueryFields(c, podsQueryParams)

	if c.Request().URL.Query().Get("watch") != "" {
		// watch pods and return over websocket
		var err error
		websocket.Handler(func(ws *websocket.Conn) {
			err = podsWatchHandler(ws, env, query)
			ws.Close()
		}).ServeHTTP(c.Response(), c.Request())
		return err
	}

	// otherwise, return the pods list
	resp, _, err := kube.Pods.List(env, query)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, resp)
}

func podsWatchHandler(ws *websocket.Conn, env string, query *url.Values) error {
	stopChan := make(chan struct{})

	eventChan := make(chan *kube.PodEvent)
	defer close(eventChan)
	go func() {
		var cmd interface{}
		err := websocket.JSON.Receive(ws, cmd)
		if err == io.EOF {
			close(stopChan)
		}
	}()
	go func() {
		for podEvent := range eventChan {
			err := websocket.JSON.Send(ws, podEvent)
			if err != nil {
				log.WithError(err).Error("error writing to stream")
			}
		}
	}()

	return kube.Pods.Watch(env, query, eventChan, stopChan)
}

func podHandler(c *echo.Context) error {
	env := c.Param("env")
	pod := c.Param("pod")

	resp, status, err := kube.Pods.Get(env, pod)
	if err != nil {
		return err
	}
	if status != nil {
		return c.JSON(http.StatusOK, status)
	}
	return c.JSON(http.StatusOK, resp)
}

func podDeleteHandler(c *echo.Context) error {
	env := c.Param("env")
	pod := c.Param("pod")

	resp, _, err := kube.Pods.Delete(env, pod)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, resp)
}
