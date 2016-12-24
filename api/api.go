package api

import (
	"sync"

	"github.com/airware/vili/environments"
	"github.com/airware/vili/errors"
	"github.com/airware/vili/middleware"
	"github.com/airware/vili/server"
	echo "gopkg.in/labstack/echo.v1"
)

// WaitGroup is the wait group to synchronize deployment rollouts
var WaitGroup sync.WaitGroup

// ExitingChan is a flag indicating that the server is exiting
var ExitingChan = make(chan struct{})

// AddHandlers adds api handlers to the server
func AddHandlers(s *server.Server) {
	envPrefix := "/api/v1/envs/:env/"
	// deployments
	s.Echo().Get(envPrefix+"deployments", envMiddleware(deploymentsHandler))
	s.Echo().Get(envPrefix+"deployments/:deployment", envMiddleware(deploymentHandler))
	s.Echo().Post(envPrefix+"deployments/:deployment/service", envMiddleware(deploymentCreateServiceHandler))
	s.Echo().Put(envPrefix+"deployments/:deployment/:action", envMiddleware(deploymentActionHandler))

	// rollouts
	s.Echo().Post(envPrefix+"deployments/:deployment/rollouts", envMiddleware(rolloutCreateHandler))
	// s.Echo().Put(envPrefix+"deployments/:deployment/rollouts/:rollout/edit", envMiddleware(rolloutEditHandler))
	// s.Echo().Post(envPrefix+"deployments/:deployment/rollouts/:rollout/:action", envMiddleware(rolloutActionHandler))

	// migrations
	s.Echo().Post(envPrefix+"migrations", envMiddleware(migrationCreateHandler))
	s.Echo().Post(envPrefix+"migrations/:migration/:action", envMiddleware(migrationActionHandler))

	// nodes
	s.Echo().Get(envPrefix+"nodes", envMiddleware(nodesHandler))
	s.Echo().Get(envPrefix+"nodes/:node", envMiddleware(nodeHandler))
	s.Echo().Put(envPrefix+"nodes/:node/:state", envMiddleware(nodeStateEditHandler))

	// pods
	s.Echo().Get(envPrefix+"pods", envMiddleware(podsHandler))
	s.Echo().Get(envPrefix+"pods/:pod", envMiddleware(podHandler))
	s.Echo().Delete(envPrefix+"pods/:pod", envMiddleware(podDeleteHandler))

	// releases
	s.Echo().Post("/api/v1/releases/:app/:tag", middleware.RequireUser(releaseCreateHandler))
	s.Echo().Delete("/api/v1/releases/:app/:tag", middleware.RequireUser(releaseDeleteHandler))

	// environments
	s.Echo().Get("/api/v1/envBranches", middleware.RequireUser(environmentBranchesHandler))
	s.Echo().Get("/api/v1/envSpec", middleware.RequireUser(environmentSpecHandler))
	s.Echo().Post("/api/v1/environments", middleware.RequireUser(environmentCreateHandler))
	s.Echo().Delete("/api/v1/environments/:env", middleware.RequireUser(environmentDeleteHandler))

	// catchall not found handler
	s.Echo().Get("/api/**", middleware.RequireUser(notFoundHandler))
}

func envMiddleware(h echo.HandlerFunc) echo.HandlerFunc {
	return middleware.RequireUser(func(c *echo.Context) error {
		if _, err := environments.Get(c.Param("env")); err != nil {
			return notFoundHandler(c)
		}
		return h(c)
	})
}

func notFoundHandler(c *echo.Context) error {
	return server.ErrorResponse(c, errors.NotFoundError(""))
}
