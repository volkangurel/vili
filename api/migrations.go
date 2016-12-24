package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/CloudCom/firego"
	"github.com/airware/vili/docker"
	"github.com/airware/vili/environments"
	"github.com/airware/vili/errors"
	"github.com/airware/vili/firebase"
	"github.com/airware/vili/log"
	"github.com/airware/vili/server"
	"github.com/airware/vili/session"
	"github.com/airware/vili/templates"
	"github.com/airware/vili/util"
	echo "gopkg.in/labstack/echo.v1"
)

// MigrationsResponse is the response for the migrations endpoint
type MigrationsResponse struct {
	Repository []*docker.Image `json:"repository,omitempty"`
	PodSpec    string          `json:"podSpec,omitempty"`
}

// Migration represents a single migration run
type Migration struct {
	ID       string    `json:"id"`
	Branch   string    `json:"branch"`
	Tag      string    `json:"tag"`
	Time     time.Time `json:"time"`
	Username string    `json:"username"`
	State    string    `json:"state"`

	Clock *Clock `json:"clock"`

	UID string `json:"uid"`
}

const (
	migrationsImageName = "migrations"
)

const (
	migrationActionStart     = "start"
	migrationActionTerminate = "terminate"
)

const (
	migrationStateNew         = "new"
	migrationStateRunning     = "running"
	migrationStateTerminating = "terminating"
	migrationStateTerminated  = "terminated"
	migrationStateCompleted   = "completed"
	migrationStateFailed      = "failed"
)

func migrationsGetHandler(c *echo.Context) error {
	env := c.Param("env")

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

	resp := MigrationsResponse{}
	failed := false

	// repository
	var waitGroup sync.WaitGroup
	if len(queryFields) == 0 || queryFields["repository"] {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			images, err := docker.GetRepository(migrationsImageName, environment.RepositoryBranches())
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
			body, err := templates.Migrations(environment.Name, environment.Branch)
			if err != nil {
				log.Error(err)
				failed = true
			}
			resp.PodSpec = string(body)
		}()
	}

	waitGroup.Wait()
	if failed {
		return fmt.Errorf("failed one of the service calls")
	}

	return c.JSON(http.StatusOK, resp)
}

func migrationCreateHandler(c *echo.Context) error {
	env := c.Param("env")

	migration := &Migration{}
	if err := json.NewDecoder(c.Request().Body).Decode(migration); err != nil {
		return err
	}
	if migration.Tag == "" {
		return server.ErrorResponse(c, errors.BadRequestError("Request missing tag"))
	}

	err := migration.Init(
		env,
		c.Get("user").(*session.User).Username,
		c.Request().URL.Query().Get("async") != "",
	)
	if err != nil {
		switch e := err.(type) {
		case MigrationInitError:
			return server.ErrorResponse(c, errors.BadRequestError(e.Error()))
		default:
			return e
		}
	}
	return c.JSON(http.StatusOK, migration)
}

func migrationActionHandler(c *echo.Context) error {
	env := c.Param("env")
	migrationID := c.Param("migration")
	action := c.Param("action")

	migration := &Migration{}
	if err := migrationDB(env, migrationID).Value(migration); err != nil {
		return err
	}
	if migration.ID == "" {
		return server.ErrorResponse(c, errors.NotFoundError("Migration not found"))
	}

	migrater, err := makeMigrater(env, migration)
	if err != nil {
		return err
	}
	switch action {
	case migrationActionStart:
		err = migrater.start()
	case migrationActionTerminate:
		err = migrater.terminate()
	default:
		return server.ErrorResponse(c, errors.NotFoundError(fmt.Sprintf("Action %s not found", action)))
	}
	if err != nil {
		return err
	}
	return c.NoContent(http.StatusNoContent)
}

// utils

// Init initializes a migration, checks to make sure it is valid, and writes the run
// data to firebase
func (m *Migration) Init(env, username string, async bool) error {
	m.ID = util.RandLowercaseString(16)
	m.Time = time.Now()
	m.Username = username
	m.State = migrationStateNew

	digest, err := docker.GetTag(migrationsImageName, m.Branch, m.Tag)
	if err != nil {
		return err
	}
	if digest == "" {
		return MigrationInitError{
			message: fmt.Sprintf("Tag %s not found for migrations", m.Tag),
		}
	}

	if err = migrationDB(env, m.ID).Set(m); err != nil {
		return err
	}

	migrater, err := makeMigrater(env, m)
	if err != nil {
		return err
	}
	migrater.addMessage(fmt.Sprintf("Migrations with tag %s created by %s", m.Tag, m.Username), "debug")

	// TODO async?
	if err := migrater.start(); err != nil {
		return err
	}

	return nil
}

func migrationDB(env, migrationID string) *firego.Firebase {
	return firebase.Database().Child(env).Child("migrations").Child(migrationID)
}

// MigrationInitError is raised if there is a problem initializing a migration
type MigrationInitError struct {
	message string
}

func (e MigrationInitError) Error() string {
	return e.message
}
