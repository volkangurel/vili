package api

import (
	"io"
	"net/http"
	"net/url"
	"sync"

	"golang.org/x/net/websocket"

	"github.com/airware/vili/kube"
	"github.com/airware/vili/log"
	echo "gopkg.in/labstack/echo.v1"
)

var (
	podsQueryParams   = []string{"labelSelector", "fieldSelector", "resourceVersion"}
	podLogQueryParams = []string{"sinceSeconds", "sinceTime"}
)

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
	var waitGroup sync.WaitGroup

	go func() {
		var cmd interface{}
		err := websocket.JSON.Receive(ws, cmd)
		if err == io.EOF {
			close(stopChan)
		}
	}()
	waitGroup.Add(1)
	go func() {
		defer waitGroup.Done()
		for podEvent := range eventChan {
			err := websocket.JSON.Send(ws, podEvent)
			if err != nil {
				log.WithError(err).Error("error writing to pods stream")
			}
		}
	}()

	cleanExit, err := kube.Pods.Watch(env, query, eventChan, stopChan)
	close(eventChan)
	waitGroup.Wait()
	if cleanExit {
		websocket.JSON.Send(ws, webSocketCloseMessage)
	}
	return err
}

// TODO remove
// func podHandler(c *echo.Context) error {
// 	env := c.Param("env")
// 	name := c.Param("pod")
// 	query := filterQueryFields(c, podQueryParams)

// 	if c.Request().URL.Query().Get("watch") != "" {
// 		// watch pod and return changes over websocket
// 		var err error
// 		websocket.Handler(func(ws *websocket.Conn) {
// 			err = podWatchHandler(ws, env, name, query)
// 			ws.Close()
// 		}).ServeHTTP(c.Response(), c.Request())
// 		return err
// 	}

// 	resp, status, err := kube.Pods.Get(env, name)
// 	if err != nil {
// 		return err
// 	}
// 	if status != nil {
// 		return c.JSON(http.StatusOK, status)
// 	}
// 	return c.JSON(http.StatusOK, resp)
// }

// func podWatchHandler(ws *websocket.Conn, env, pod string, query *url.Values) error {
// 	stopChan := make(chan struct{})
// 	eventChan := make(chan *kube.PodEvent)
// 	var waitGroup sync.WaitGroup

// 	go func() {
// 		var cmd interface{}
// 		err := websocket.JSON.Receive(ws, cmd)
// 		if err == io.EOF {
// 			close(stopChan)
// 		}
// 	}()
// 	waitGroup.Add(1)
// 	go func() {
// 		defer waitGroup.Done()
// 		for podEvent := range eventChan {
// 			err := websocket.JSON.Send(ws, podEvent)
// 			if err != nil {
// 				log.WithError(err).Error("error writing to pod stream")
// 			}
// 		}
// 	}()

// 	cleanExit, err := kube.Pods.WatchPod(env, pod, query, eventChan, stopChan)
// 	close(eventChan)
// 	waitGroup.Wait()
// 	if cleanExit {
// 		websocket.JSON.Send(ws, webSocketCloseMessage)
// 	}
// 	return err
// }

func podLogHandler(c *echo.Context) error {
	env := c.Param("env")
	name := c.Param("pod")
	query := filterQueryFields(c, podLogQueryParams)

	if c.Request().URL.Query().Get("follow") != "" {
		// watch pod logs and return changes over websocket
		var err error
		websocket.Handler(func(ws *websocket.Conn) {
			err = podLogWatchHandler(ws, env, name, query)
			ws.Close()
		}).ServeHTTP(c.Response(), c.Request())
		return err
	}

	resp, status, err := kube.Pods.GetLog(env, name)
	if err != nil {
		return err
	}
	if status != nil {
		return c.JSON(http.StatusOK, status)
	}
	return c.JSON(http.StatusOK, resp)
}

func podLogWatchHandler(ws *websocket.Conn, env, name string, query *url.Values) error {
	stopChan := make(chan struct{})
	logChan := make(chan string)
	var waitGroup sync.WaitGroup

	go func() {
		var cmd interface{}
		err := websocket.JSON.Receive(ws, cmd)
		if err == io.EOF {
			close(stopChan)
		}
	}()
	waitGroup.Add(1)
	go func() {
		defer waitGroup.Done()
		for line := range logChan {
			err := websocket.JSON.Send(ws, map[string]string{
				"type":   "LOG",
				"object": line,
			})
			if err != nil {
				log.WithError(err).Error("error writing to pod log stream")
			}
		}
	}()

	cleanExit, err := kube.Pods.WatchLog(env, name, query, logChan, stopChan)
	close(logChan)
	waitGroup.Wait()
	if cleanExit {
		websocket.JSON.Send(ws, webSocketCloseMessage)
	}
	return err
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
