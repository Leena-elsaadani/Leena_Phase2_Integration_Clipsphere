package routes

import (
	"auth-service/internal/handlers"
	"auth-service/internal/middleware"
	"auth-service/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func NewRouter(authSvc *services.AuthService, frontendURL string) *gin.Engine {
	r := gin.Default()

	// Add metrics middleware globally (before any other routes)
	r.Use(middleware.PrometheusMiddleware())

	h := handlers.NewAuthHandler(authSvc, frontendURL)

	// Metrics endpoint (no auth required)
	r.GET("/metrics", gin.WrapH(promhttp.Handler()))

	r.GET("/auth/google/login", h.GoogleLogin)
	r.GET("/auth/google/callback", h.GoogleCallback)
	r.POST("/auth/logout", h.Logout)
	r.POST("/auth/validate", h.Validate)
	r.GET("/auth/public-key", h.PublicKey)
	r.GET("/auth/failure", h.Failure)
	r.GET("/health", h.Health)

	return r
}
