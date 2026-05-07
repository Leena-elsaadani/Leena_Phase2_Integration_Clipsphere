package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type JWTMiddleware struct{}

func NewJWTMiddleware(path string) (*JWTMiddleware, error) {
	return &JWTMiddleware{}, nil
}

func (m *JWTMiddleware) VerifyJWT() gin.HandlerFunc {
	return func(c *gin.Context) {
		// ADR-002: gateway validates JWT and forwards trusted identity headers.
		sub := c.GetHeader("X-User-Id")
		role := c.GetHeader("X-User-Role")
		email := c.GetHeader("X-User-Email")
		if sub == "" || role == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Missing token"})
			return
		}
		c.Set("user", map[string]any{"sub": sub, "role": role, "email": email})
		c.Next()
	}
}

func RequireRole(minRole string) gin.HandlerFunc {
	roleRank := map[string]int{"user": 0, "admin": 1}
	return func(c *gin.Context) {
		v, ok := c.Get("user")
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Missing token"})
			return
		}
		claims := v.(map[string]any)
		role, _ := claims["role"].(string)
		if roleRank[role] < roleRank[minRole] {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
			return
		}
		c.Next()
	}
}
