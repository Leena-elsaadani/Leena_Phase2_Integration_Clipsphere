package unit

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
	"user-service/internal/handlers"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

type userContractMock struct {
	searchQ string
}

func (m *userContractMock) ListUsers(q, pageRaw, limitRaw string) (map[string]any, error) {
	return map[string]any{}, nil
}
func (m *userContractMock) GetByID(id string) (any, error)                         { return nil, nil }
func (m *userContractMock) UpdateMe(id string, name, avatar *string) (map[string]any, error) {
	return map[string]any{"id": id}, nil
}
func (m *userContractMock) UpdateRole(id, role string) (map[string]any, error) { return nil, nil }
func (m *userContractMock) DeleteByID(id string) (int64, error)                 { return 0, nil }
func (m *userContractMock) Search(q string) ([]map[string]any, error) {
	m.searchQ = q
	return []map[string]any{}, nil
}
func (m *userContractMock) SearchUsers(query string, limit, offset int) ([]map[string]any, int64, error) {
	m.searchQ = query
	return []map[string]any{}, int64(0), nil
}

func TestUpdateMeRequiresAtLeastOneField(t *testing.T) {
	gin.SetMode(gin.TestMode)
	m := &userContractMock{}
	h := handlers.NewUserHandler(m)
	r := gin.New()
	r.PATCH("/users/me", func(c *gin.Context) {
		c.Set("user", map[string]any{"sub": "u-1"})
		h.UpdateMe(c)
	})

	req := httptest.NewRequest(http.MethodPatch, "/users/me", bytes.NewBufferString(`{}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestSearchPassesQueryToService(t *testing.T) {
	gin.SetMode(gin.TestMode)
	m := &userContractMock{}
	h := handlers.NewUserHandler(m)
	r := gin.New()
	r.GET("/users/search", h.SearchUsers)

	req := httptest.NewRequest(http.MethodGet, "/users/search?q=ali", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "ali", m.searchQ)
}

func TestSearchReturnsEmptyUsersArrayWhenNoResults(t *testing.T) {
	gin.SetMode(gin.TestMode)
	m := &userContractMock{}
	h := handlers.NewUserHandler(m)
	r := gin.New()
	r.GET("/users/search", h.SearchUsers)

	req := httptest.NewRequest(http.MethodGet, "/users/search?q=ali", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), `"users":[]`)
	assert.Contains(t, rec.Body.String(), `"total":0`)
	assert.Contains(t, rec.Body.String(), `"query":"ali"`)
}
