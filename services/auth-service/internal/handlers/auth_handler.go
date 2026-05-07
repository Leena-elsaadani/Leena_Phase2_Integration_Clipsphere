package handlers

import (
	"context"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	auth AuthContract
}

type AuthContract interface {
	GoogleLoginURL() string
	HandleGoogleCallback(ctx context.Context, code string) (string, map[string]any, error)
	Logout(token string) error
	ValidateToken(token string) (map[string]any, string, error)
	PublicKey() string
}

func NewAuthHandler(auth AuthContract) *AuthHandler {
	return &AuthHandler{auth: auth}
}

func (h *AuthHandler) GoogleLogin(c *gin.Context) {
	c.Redirect(http.StatusFound, h.auth.GoogleLoginURL())
}

func (h *AuthHandler) GoogleCallback(c *gin.Context) {
	code := c.Query("code")
	if code == "" {
		c.Redirect(http.StatusFound, "/auth/failure")
		return
	}
	token, user, err := h.auth.HandleGoogleCallback(c.Request.Context(), code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to issue token"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": token, "user": user})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	token := extractBearer(c.GetHeader("Authorization"))
	_ = h.auth.Logout(token)
	c.JSON(http.StatusOK, gin.H{"message": "Logged out"})
}

func (h *AuthHandler) Validate(c *gin.Context) {
	token := extractBearer(c.GetHeader("Authorization"))
	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No token"})
		return
	}
	claims, msg, err := h.auth.ValidateToken(token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": msg})
		return
	}
	if sub, ok := claims["sub"]; ok {
		c.Header("X-User-Id", toString(sub))
	}
	if role, ok := claims["role"]; ok {
		c.Header("X-User-Role", toString(role))
	}
	if email, ok := claims["email"]; ok {
		c.Header("X-User-Email", toString(email))
	}
	c.JSON(http.StatusOK, gin.H{"valid": true, "user": claims})
}

func (h *AuthHandler) PublicKey(c *gin.Context) {
	c.Data(http.StatusOK, "text/plain; charset=utf-8", []byte(h.auth.PublicKey()))
}

func (h *AuthHandler) Failure(c *gin.Context) {
	c.JSON(http.StatusUnauthorized, gin.H{"error": "Google auth failed"})
}

func (h *AuthHandler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func extractBearer(auth string) string {
	if strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimPrefix(auth, "Bearer ")
	}
	return ""
}

func toString(v any) string {
	switch t := v.(type) {
	case string:
		return t
	default:
		return ""
	}
}
