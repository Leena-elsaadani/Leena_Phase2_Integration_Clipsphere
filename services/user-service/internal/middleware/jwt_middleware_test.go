package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestVerifyJWTSuccess(t *testing.T) {
	gin.SetMode(gin.TestMode)
	mw, err := NewJWTMiddleware("")
	assert.NoError(t, err)

	r := gin.New()
	r.GET("/secure", mw.VerifyJWT(), func(c *gin.Context) { c.Status(http.StatusOK) })
	req := httptest.NewRequest(http.MethodGet, "/secure", nil)
	req.Header.Set("X-User-Id", "u1")
	req.Header.Set("X-User-Role", "user")
	req.Header.Set("X-User-Email", "u1@test.com")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestVerifyJWTMissingToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	mw, err := NewJWTMiddleware("")
	assert.NoError(t, err)

	r := gin.New()
	r.GET("/secure", mw.VerifyJWT(), func(c *gin.Context) { c.Status(http.StatusOK) })
	req := httptest.NewRequest(http.MethodGet, "/secure", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.JSONEq(t, `{"error":"Missing token"}`, rec.Body.String())
}

func TestRequireRole(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/admin", func(c *gin.Context) {
		c.Set("user", map[string]any{"role": "user"})
		c.Next()
	}, RequireRole("admin"), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/admin", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusForbidden, rec.Code)
	assert.JSONEq(t, `{"error":"Insufficient permissions"}`, rec.Body.String())
}
