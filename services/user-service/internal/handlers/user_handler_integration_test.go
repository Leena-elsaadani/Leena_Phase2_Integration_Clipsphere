package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"user-service/internal/middleware"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

type fakeUserService struct {
	getByIDResult  any
	listResult     map[string]any
	updateMeResult map[string]any
	updateRoleRes  map[string]any
	deleteCount    int64
	searchResult   []map[string]any
}

func (f *fakeUserService) ListUsers(_, _, _ string) (map[string]any, error) { return f.listResult, nil }
func (f *fakeUserService) GetByID(_ string) (any, error)                     { return f.getByIDResult, nil }
func (f *fakeUserService) UpdateMe(_ string, _, _ *string) (map[string]any, error) {
	return f.updateMeResult, nil
}
func (f *fakeUserService) UpdateRole(_, _ string) (map[string]any, error) { return f.updateRoleRes, nil }
func (f *fakeUserService) DeleteByID(_ string) (int64, error)             { return f.deleteCount, nil }
func (f *fakeUserService) Search(_ string) ([]map[string]any, error)      { return f.searchResult, nil }
func (f *fakeUserService) SearchUsers(_ string, _ int, _ int) ([]map[string]any, int64, error) {
	return f.searchResult, int64(len(f.searchResult)), nil
}

func withJWT(role, sub string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("user", map[string]any{"role": role, "sub": sub, "email": "user@test.com"})
		c.Next()
	}
}

func setupUserRouter(svc *fakeUserService) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := NewUserHandler(svc)
	users := r.Group("/users")
	users.GET("/me", withJWT("user", "user-uuid-1"), h.GetMe)
	users.GET("/:id", withJWT("user", "user-uuid-1"), h.GetByID)
	users.PATCH("/me", withJWT("user", "user-uuid-1"), h.UpdateMe)
	users.PATCH("/:id/role", withJWT("admin", "admin-uuid-1"), h.UpdateRole)
	users.DELETE("/:id", withJWT("admin", "admin-uuid-1"), h.DeleteUser)
	users.GET("", withJWT("admin", "admin-uuid-1"), h.ListUsers)
	users.GET("/search", withJWT("user", "user-uuid-1"), h.SearchUsers)
	r.GET("/health", h.Health)
	return r
}

func setupUserOnlyRoleRouter(svc *fakeUserService) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := NewUserHandler(svc)
	users := r.Group("/users")
	users.GET("", withJWT("user", "user-uuid-1"), middleware.RequireRole("admin"), h.ListUsers)
	users.PATCH("/:id/role", withJWT("user", "user-uuid-1"), middleware.RequireRole("admin"), h.UpdateRole)
	users.DELETE("/:id", withJWT("user", "user-uuid-1"), middleware.RequireRole("admin"), h.DeleteUser)
	return r
}

func TestUserHealth(t *testing.T) {
	r := setupUserRouter(&fakeUserService{})
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestGetMe(t *testing.T) {
	r := setupUserRouter(&fakeUserService{getByIDResult: map[string]any{"id": "user-uuid-1", "email": "user@test.com"}})
	req := httptest.NewRequest(http.MethodGet, "/users/me", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), `"email":"user@test.com"`)
}

func TestGetMeNotFound(t *testing.T) {
	r := setupUserRouter(&fakeUserService{getByIDResult: nil})
	req := httptest.NewRequest(http.MethodGet, "/users/me", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestGetUserByID(t *testing.T) {
	r := setupUserRouter(&fakeUserService{getByIDResult: map[string]any{"id": "user-uuid-1"}})
	req := httptest.NewRequest(http.MethodGet, "/users/user-uuid-1", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestPatchMe(t *testing.T) {
	r := setupUserRouter(&fakeUserService{updateMeResult: map[string]any{"id": "user-uuid-1", "name": "New Name"}})
	req := httptest.NewRequest(http.MethodPatch, "/users/me", strings.NewReader(`{"name":"New Name"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), `"name":"New Name"`)
}

func TestPatchMeNoFields(t *testing.T) {
	r := setupUserRouter(&fakeUserService{})
	req := httptest.NewRequest(http.MethodPatch, "/users/me", strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestPatchRole(t *testing.T) {
	r := setupUserRouter(&fakeUserService{updateRoleRes: map[string]any{"id": "user-uuid-1", "role": "admin"}})
	req := httptest.NewRequest(http.MethodPatch, "/users/user-uuid-1/role", strings.NewReader(`{"role":"admin"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), `"role":"admin"`)
}

func TestPatchRoleInvalidValue(t *testing.T) {
	r := setupUserRouter(&fakeUserService{})
	req := httptest.NewRequest(http.MethodPatch, "/users/user-uuid-1/role", strings.NewReader(`{"role":"superuser"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestPatchRoleForbiddenForRegularUser(t *testing.T) {
	r := setupUserOnlyRoleRouter(&fakeUserService{})
	req := httptest.NewRequest(http.MethodPatch, "/users/user-uuid-1/role", strings.NewReader(`{"role":"admin"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusForbidden, rec.Code)
}

func TestDeleteUser(t *testing.T) {
	r := setupUserRouter(&fakeUserService{deleteCount: 1})
	req := httptest.NewRequest(http.MethodDelete, "/users/user-uuid-1", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusNoContent, rec.Code)
}

func TestDeleteUserNotFound(t *testing.T) {
	r := setupUserRouter(&fakeUserService{deleteCount: 0})
	req := httptest.NewRequest(http.MethodDelete, "/users/nonexistent", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestDeleteUserForbiddenForRegularUser(t *testing.T) {
	r := setupUserOnlyRoleRouter(&fakeUserService{deleteCount: 1})
	req := httptest.NewRequest(http.MethodDelete, "/users/user-uuid-1", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusForbidden, rec.Code)
}

func TestListUsers(t *testing.T) {
	r := setupUserRouter(&fakeUserService{listResult: map[string]any{"users": []map[string]any{{"id": "u1"}, {"id": "u2"}}, "page": 1, "limit": 20}})
	req := httptest.NewRequest(http.MethodGet, "/users", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), `"users"`)
}

func TestListUsersForbiddenForRegularUser(t *testing.T) {
	r := setupUserOnlyRoleRouter(&fakeUserService{})
	req := httptest.NewRequest(http.MethodGet, "/users", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusForbidden, rec.Code)
}

func TestSearchUsers(t *testing.T) {
	r := setupUserRouter(&fakeUserService{searchResult: []map[string]any{{"id": "u1", "email": "user@test.com"}}})
	req := httptest.NewRequest(http.MethodGet, "/users/search?q=test", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), `"users"`)
}

func TestSearchUsersMissingQuery(t *testing.T) {
	r := setupUserRouter(&fakeUserService{})
	req := httptest.NewRequest(http.MethodGet, "/users/search", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}
