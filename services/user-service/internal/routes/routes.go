package routes

import (
	"user-service/internal/config"
	"user-service/internal/handlers"
	"user-service/internal/middleware"
	"user-service/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func NewRouter(cfg config.Config, userSvc *services.UserService) *gin.Engine {
	r := gin.Default()

	// Add metrics middleware globally (before any other routes)
	r.Use(middleware.PrometheusMiddleware())

	jwtMW, err := middleware.NewJWTMiddleware(cfg.JWTPublicKey)
	if err != nil {
		panic(err)
	}
	h := handlers.NewUserHandler(userSvc)

	// Metrics endpoint (no auth required)
	r.GET("/metrics", gin.WrapH(promhttp.Handler()))

	users := r.Group("/users")
	{
		users.GET("/me", jwtMW.VerifyJWT(), h.GetProfile)
		users.PATCH("/me", jwtMW.VerifyJWT(), h.UpdateProfile)
		users.GET("/search", jwtMW.VerifyJWT(), h.SearchUsers)
		users.GET("/:id", jwtMW.VerifyJWT(), h.GetByID)

		users.GET("", jwtMW.VerifyJWT(), middleware.RequireRole("admin"), h.ListUsers)
		users.PATCH("/:id/role", jwtMW.VerifyJWT(), middleware.RequireRole("admin"), h.UpdateRole)
		users.DELETE("/:id", jwtMW.VerifyJWT(), middleware.RequireRole("admin"), h.DeleteUser)
	}

	r.GET("/health", h.Health)
	return r
}
