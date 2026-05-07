package main

import (
	"log"

	"auth-service/internal/config"
	"auth-service/internal/repository"
	"auth-service/internal/routes"
	"auth-service/internal/services"
)

func main() {
	cfg := config.Load()

	db, err := repository.NewDB(cfg.PostgresURL)
	if err != nil {
		log.Fatalf("db init failed: %v", err)
	}
	if err := repository.InitSchema(db); err != nil {
		log.Fatalf("db schema init failed: %v", err)
	}

	redisSvc, err := services.NewRedisService(cfg.RedisURL)
	if err != nil {
		log.Fatalf("redis init failed: %v", err)
	}

	authSvc, err := services.NewAuthService(cfg, db, redisSvc)
	if err != nil {
		log.Fatalf("auth service init failed: %v", err)
	}

	r := routes.NewRouter(authSvc)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
