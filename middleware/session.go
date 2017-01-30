package middleware

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/airware/vili/session"
	echo "gopkg.in/labstack/echo.v1"
)

// Session logs the user in using the configured session service
func Session() echo.MiddlewareFunc {
	return func(h echo.HandlerFunc) echo.HandlerFunc {
		return func(c *echo.Context) error {
			if !strings.HasPrefix(c.Request().URL.Path, "/admin/") {
				user, err := session.GetUser(c.Request())
				if err != nil {
					return err
				}
				if user != nil {
					c.Set("user", user)
				}
			}
			if err := h(c); err != nil {
				c.Error(err)
			}

			return nil
		}
	}
}

// RequireUser redirects to the login page if the user is not logged in
func RequireUser(h echo.HandlerFunc) echo.HandlerFunc {
	return func(c *echo.Context) error {
		if c.Get("user") == nil {
			redirectTo := c.Request().URL.String()
			if redirectTo == "/logout" {
				redirectTo = "/"
			}
			c.Redirect(http.StatusTemporaryRedirect, "/login?redirect="+url.QueryEscape(redirectTo))
			return nil
		}
		if err := h(c); err != nil {
			c.Error(err)
		}
		return nil
	}
}
