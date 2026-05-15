package unit

import (
	"bytes"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"user-service/internal/handlers"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

// errorMock is a UserContract implementation that returns configurable errors/results.
type errorMock struct {
	listErr          error
	listResult       map[string]any
	getByIDErr       error
	getByIDResult    any
	updateMeErr      error
	updateMeResult   map[string]any
	updateRoleErr    error
	updateRoleResult map[string]any
	deleteErr        error
	deleteRows       int64
	searchErr        error
	searchResult     []map[string]any
}

func (m *errorMock) ListUsers(q, pageRaw, limitRaw string) (map[string]any, error) {
	return m.listResult, m.listErr
}
func (m *errorMock) GetByID(id string) (any, error) {
	return m.getByIDResult, m.getByIDErr
}
func (m *errorMock) UpdateMe(id string, name, avatar *string) (map[string]any, error) {
	return m.updateMeResult, m.updateMeErr
}
func (m *errorMock) UpdateRole(id, role string) (map[string]any, error) {
	return m.updateRoleResult, m.updateRoleErr
}
func (m *errorMock) DeleteByID(id string) (int64, error) {
	return m.deleteRows, m.deleteErr
}
func (m *errorMock) Search(q string) ([]map[string]any, error) {
	return m.searchResult, m.searchErr
}

// injectUser is a helper that sets the "user" context key (simulates JWT middleware).
func injectUser(sub, role string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("user", map[string]any{"sub": sub, "role": role})
		c.Next()
	}
}

// ---------- ListUsers ----------

func TestListUsersServiceError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	m := &errorMock{listErr: errors.New("db down")}
	h := handlers.NewUserHandler(m)
	r := gin.New()
	r.GET("/users", h.ListUsers)

	req := httptest.NewRequest(http.MethodGet, "/users", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusInternalServerError, rec.Code)
	assert.Contains(t, rec.Body.String(), "error")
}

// ---------- GetMe ----------

func TestGetMeServiceError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	m := &errorMock{getByIDErr: errors.New("service exploded")}
	h := handlers.NewUserHandler(m)
	r := gin.New()
	r.GET("/users/me", injectUser("u-1", "user"), h.GetMe)

	req := httptest.NewRequest(http.MethodGet, "/users/me", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusInternalServerError, rec.Code)
}

// ---------- GetByID ----------

func TestGetByIDServiceError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	m := &errorMock{getByIDErr: errors.New("db error")}
	h := handlers.NewUserHandler(m)
	r := gin.New()
	r.GET("/users/:id", h.GetByID)

	req := httptest.NewRequest(http.MethodGet, "/users/some-uuid", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusInternalServerError, rec.Code)
}

func TestGetByIDFound(t *testing.T) {
	gin.SetMode(gin.TestMode)
	m := &errorMock{getByIDResult: map[string]any{"id": "abc", "email": "found@test.com"}}
	h := handlers.NewUserHandler(m)
	r := gin.New()
	r.GET("/users/:id", h.GetByID)

	req := httptest.NewRequest(http.MethodGet, "/users/abc", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), "found@test.com")
}

// ---------- UpdateMe ----------

func TestUpdateMeServiceError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	m := &errorMock{updateMeErr: errors.New("update failed")}
	h := handlers.NewUserHandler(m)
	r := gin.New()
	r.PATCH("/users/me", injectUser("u-1", "user"), h.UpdateMe)

	body := bytes.NewBufferString(`{"name":"Alice"}`)
	req := httptest.NewRequest(http.MethodPatch, "/users/me", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusInternalServerError, rec.Code)
}

func TestUpdateMeUserNotFound(t *testing.T) {
	gin.SetMode(gin.TestMode)
	// updateMeResult is nil (zero value) and updateMeErr is nil → handler returns 404
	m := &errorMock{}
	h := handlers.NewUserHandler(m)
	r := gin.New()
	r.PATCH("/users/me", injectUser("u-1", "user"), h.UpdateMe)

	body := bytes.NewBufferString(`{"name":"Alice"}`)
	req := httptest.NewRequest(http.MethodPatch, "/users/me", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusNotFound, rec.Code)
}

// ---------- UpdateRole ----------

func TestUpdateRoleServiceError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	m := &errorMock{updateRoleErr: errors.New("role update failed")}
	h := handlers.NewUserHandler(m)
	r := gin.New()
	r.PATCH("/users/:id/role", h.UpdateRole)

	body := bytes.NewBufferString(`{"role":"admin"}`)
	req := httptest.NewRequest(http.MethodPatch, "/users/abc/role", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusInternalServerError, rec.Code)
}

func TestUpdateRoleUserNotFound(t *testing.T) {
	gin.SetMode(gin.TestMode)
	// updateRoleResult is nil and updateRoleErr is nil → handler returns 404
	m := &errorMock{}
	h := handlers.NewUserHandler(m)
	r := gin.New()
	r.PATCH("/users/:id/role", h.UpdateRole)

	body := bytes.NewBufferString(`{"role":"user"}`)
	req := httptest.NewRequest(http.MethodPatch, "/users/nonexistent/role", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusNotFound, rec.Code)
}

// ---------- DeleteUser ----------

func TestDeleteUserServiceError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	m := &errorMock{deleteErr: errors.New("delete failed")}
	h := handlers.NewUserHandler(m)
	r := gin.New()
	r.DELETE("/users/:id", h.DeleteUser)

	req := httptest.NewRequest(http.MethodDelete, "/users/abc", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusInternalServerError, rec.Code)
}

// ---------- Search ----------

func TestSearchServiceError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	m := &errorMock{searchErr: errors.New("search failed")}
	h := handlers.NewUserHandler(m)
	r := gin.New()
	r.GET("/users/search", h.Search)

	req := httptest.NewRequest(http.MethodGet, "/users/search?q=bob", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusInternalServerError, rec.Code)
}

// ---------- Health (extra coverage) ----------

func TestHealthHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)
	m := &errorMock{}
	h := handlers.NewUserHandler(m)
	r := gin.New()
	r.GET("/health", h.Health)

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), "ok")
}
