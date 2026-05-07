package routes

import (
	"user-service/internal/config"
	"user-service/internal/handlers"
	"user-service/internal/middleware"
	"user-service/internal/services"

	"github.com/gin-gonic/gin"
)

func NewRouter(cfg config.Config, userSvc *services.UserService) *gin.Engine {
	r := gin.Default()

	jwtMW, err := middleware.NewJWTMiddleware(cfg.JWTPublicKey)
	if err != nil {
		panic(err)
	}
	h := handlers.NewUserHandler(userSvc)

	users := r.Group("/users")
	{
		users.GET("/me", jwtMW.VerifyJWT(), h.GetMe)
		users.PATCH("/me", jwtMW.VerifyJWT(), h.UpdateMe)
		users.GET("/search", jwtMW.VerifyJWT(), h.Search)
		users.GET("/:id", jwtMW.VerifyJWT(), h.GetByID)

		users.GET("", jwtMW.VerifyJWT(), middleware.RequireRole("admin"), h.ListUsers)
		users.PATCH("/:id/role", jwtMW.VerifyJWT(), middleware.RequireRole("admin"), h.UpdateRole)
		users.DELETE("/:id", jwtMW.VerifyJWT(), middleware.RequireRole("admin"), h.DeleteUser)
	}

	r.GET("/health", h.Health)
	return r
}
