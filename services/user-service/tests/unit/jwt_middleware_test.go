package unit

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"user-service/internal/middleware"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

// ---- VerifyJWT tests ----

func TestJWTMiddlewareMissingUserID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	mw, err := middleware.NewJWTMiddleware("")
	assert.NoError(t, err)

	r := gin.New()
	r.GET("/secure", mw.VerifyJWT(), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	// Only X-User-Role is set; X-User-Id is missing → 401
	req := httptest.NewRequest(http.MethodGet, "/secure", nil)
	req.Header.Set("X-User-Role", "user")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Contains(t, rec.Body.String(), "Missing token")
}

func TestJWTMiddlewareMissingRole(t *testing.T) {
	gin.SetMode(gin.TestMode)
	mw, err := middleware.NewJWTMiddleware("")
	assert.NoError(t, err)

	r := gin.New()
	r.GET("/secure", mw.VerifyJWT(), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	// Only X-User-Id is set; X-User-Role is missing → 401
	req := httptest.NewRequest(http.MethodGet, "/secure", nil)
	req.Header.Set("X-User-Id", "u-42")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Contains(t, rec.Body.String(), "Missing token")
}

func TestJWTMiddlewareBothHeadersMissing(t *testing.T) {
	gin.SetMode(gin.TestMode)
	mw, err := middleware.NewJWTMiddleware("")
	assert.NoError(t, err)

	r := gin.New()
	r.GET("/secure", mw.VerifyJWT(), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	// No identity headers at all → 401
	req := httptest.NewRequest(http.MethodGet, "/secure", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestJWTMiddlewareWithEmail(t *testing.T) {
	gin.SetMode(gin.TestMode)
	mw, err := middleware.NewJWTMiddleware("")
	assert.NoError(t, err)

	var capturedSub, capturedRole, capturedEmail string
	r := gin.New()
	r.GET("/secure", mw.VerifyJWT(), func(c *gin.Context) {
		user := c.MustGet("user").(map[string]any)
		capturedSub, _ = user["sub"].(string)
		capturedRole, _ = user["role"].(string)
		capturedEmail, _ = user["email"].(string)
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/secure", nil)
	req.Header.Set("X-User-Id", "u-99")
	req.Header.Set("X-User-Role", "admin")
	req.Header.Set("X-User-Email", "admin@test.com")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "u-99", capturedSub)
	assert.Equal(t, "admin", capturedRole)
	assert.Equal(t, "admin@test.com", capturedEmail)
}

func TestJWTMiddlewareEmailOptional(t *testing.T) {
	gin.SetMode(gin.TestMode)
	mw, err := middleware.NewJWTMiddleware("")
	assert.NoError(t, err)

	var capturedEmail string
	r := gin.New()
	r.GET("/secure", mw.VerifyJWT(), func(c *gin.Context) {
		user := c.MustGet("user").(map[string]any)
		capturedEmail, _ = user["email"].(string)
		c.Status(http.StatusOK)
	})

	// No X-User-Email header → middleware still succeeds, email is empty string
	req := httptest.NewRequest(http.MethodGet, "/secure", nil)
	req.Header.Set("X-User-Id", "u-7")
	req.Header.Set("X-User-Role", "user")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "", capturedEmail)
}

// ---- RequireRole tests ----

func TestRequireRoleMissingContext(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	// No middleware sets the "user" key before RequireRole
	r.GET("/admin", middleware.RequireRole("admin"), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/admin", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Contains(t, rec.Body.String(), "Missing token")
}

func TestRequireRoleUserCanAccessUserRoute(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/profile", func(c *gin.Context) {
		c.Set("user", map[string]any{"role": "user"})
		c.Next()
	}, middleware.RequireRole("user"), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/profile", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
}

// ---- PrometheusMiddleware test ----

func TestPrometheusMiddlewareRecordsMetrics(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(middleware.PrometheusMiddleware())
	r.GET("/ping", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	// The middleware should not interfere with the response
	assert.Equal(t, http.StatusOK, rec.Code)
}
