package routes

import (
	"auth-service/internal/handlers"
	"auth-service/internal/services"

	"github.com/gin-gonic/gin"
)

func NewRouter(authSvc *services.AuthService) *gin.Engine {
	r := gin.Default()
	h := handlers.NewAuthHandler(authSvc)

	r.GET("/auth/google/login", h.GoogleLogin)
	r.GET("/auth/google/callback", h.GoogleCallback)
	r.POST("/auth/logout", h.Logout)
	r.POST("/auth/validate", h.Validate)
	r.GET("/auth/public-key", h.PublicKey)
	r.GET("/auth/failure", h.Failure)
	r.GET("/health", h.Health)

	return r
}
