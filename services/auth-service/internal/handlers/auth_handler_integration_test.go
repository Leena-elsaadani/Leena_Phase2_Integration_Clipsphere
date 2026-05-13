package handlers

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

type fakeAuthService struct {
	validateClaims map[string]any
	validateMsg    string
	validateErr    error
	callbackToken  string
	callbackUser   map[string]any
	callbackErr    error
	publicKey      string
	lastLogout     string
	lastCode       string
}

func (f *fakeAuthService) GoogleLoginURL() string { return "https://accounts.google.com/mock" }
func (f *fakeAuthService) HandleGoogleCallback(_ context.Context, code string) (string, map[string]any, error) {
	f.lastCode = code
	return f.callbackToken, f.callbackUser, f.callbackErr
}
func (f *fakeAuthService) GitHubLoginURL() string { return "https://github.com/mock" }
func (f *fakeAuthService) HandleGitHubCallback(_ context.Context, code string) (string, map[string]any, error) {
	f.lastCode = code
	return f.callbackToken, f.callbackUser, f.callbackErr
}
func (f *fakeAuthService) Logout(token string) error {
	f.lastLogout = token
	return nil
}
func (f *fakeAuthService) ValidateToken(_ string) (map[string]any, string, error) {
	return f.validateClaims, f.validateMsg, f.validateErr
}
func (f *fakeAuthService) PublicKey() string { return f.publicKey }

func setupAuthRouter(fake *fakeAuthService) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := NewAuthHandler(fake)
	r.GET("/health", h.Health)
	r.GET("/auth/google/callback", h.GoogleCallback)
	r.GET("/auth/github/callback", h.GitHubCallback)
	r.POST("/auth/validate", h.Validate)
	r.POST("/auth/logout", h.Logout)
	r.GET("/auth/public-key", h.PublicKey)
	return r
}

func TestHealth(t *testing.T) {
	r := setupAuthRouter(&fakeAuthService{})
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.JSONEq(t, `{"status":"ok"}`, rec.Body.String())
}

func TestGoogleCallbackReturnsTokenAndUser(t *testing.T) {
	fake := &fakeAuthService{
		callbackToken: "a.b.c",
		callbackUser:  map[string]any{"id": "user-uuid-1", "email": "test@example.com", "name": "Test User", "role": "user"},
	}
	r := setupAuthRouter(fake)
	req := httptest.NewRequest(http.MethodGet, "/auth/google/callback?code=fake-code", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusFound, rec.Code)
	assert.Equal(t, "http://localhost:3000/login?token=a.b.c", rec.Header().Get("Location"))
	assert.Equal(t, "fake-code", fake.lastCode)
}

func TestGitHubCallbackReturnsTokenAndUser(t *testing.T) {
	fake := &fakeAuthService{
		callbackToken: "x.y.z",
		callbackUser:  map[string]any{"id": "user-uuid-2", "email": "git@example.com", "name": "GitHub User", "role": "user"},
	}
	r := setupAuthRouter(fake)
	req := httptest.NewRequest(http.MethodGet, "/auth/github/callback?code=fake-code", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusFound, rec.Code)
	assert.Equal(t, "http://localhost:3000/login?token=x.y.z", rec.Header().Get("Location"))
	assert.Equal(t, "fake-code", fake.lastCode)
}

func TestValidateTokenFlow(t *testing.T) {
	r := setupAuthRouter(&fakeAuthService{
		validateClaims: map[string]any{"sub": "user-uuid-1", "email": "test@example.com", "role": "user", "name": "Test User"},
	})
	req := httptest.NewRequest(http.MethodPost, "/auth/validate", nil)
	req.Header.Set("Authorization", "Bearer valid-token")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), `"valid":true`)
}

func TestValidateTokenInvalidated(t *testing.T) {
	r := setupAuthRouter(&fakeAuthService{validateMsg: "Token invalidated", validateErr: errors.New("missing redis session")})
	req := httptest.NewRequest(http.MethodPost, "/auth/validate", nil)
	req.Header.Set("Authorization", "Bearer invalidated-token")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.JSONEq(t, `{"error":"Token invalidated"}`, rec.Body.String())
}

func TestValidateTokenMissingHeader(t *testing.T) {
	r := setupAuthRouter(&fakeAuthService{})
	req := httptest.NewRequest(http.MethodPost, "/auth/validate", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.JSONEq(t, `{"error":"No token"}`, rec.Body.String())
}

func TestLogout(t *testing.T) {
	fake := &fakeAuthService{}
	r := setupAuthRouter(fake)
	req := httptest.NewRequest(http.MethodPost, "/auth/logout", nil)
	req.Header.Set("Authorization", "Bearer some-token")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.JSONEq(t, `{"message":"Logged out"}`, rec.Body.String())
	assert.Equal(t, "some-token", fake.lastLogout)
}

func TestLogoutNoToken(t *testing.T) {
	fake := &fakeAuthService{}
	r := setupAuthRouter(fake)
	req := httptest.NewRequest(http.MethodPost, "/auth/logout", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.JSONEq(t, `{"message":"Logged out"}`, rec.Body.String())
	assert.Equal(t, "", fake.lastLogout)
}

func TestPublicKey(t *testing.T) {
	r := setupAuthRouter(&fakeAuthService{publicKey: "-----BEGIN PUBLIC KEY-----\nabc\n-----END PUBLIC KEY-----"})
	req := httptest.NewRequest(http.MethodGet, "/auth/public-key", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), "PUBLIC KEY")
}
