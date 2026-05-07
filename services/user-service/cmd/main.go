package main

import (
	"log"

	"user-service/internal/config"
	"user-service/internal/repository"
	"user-service/internal/routes"
	"user-service/internal/services"
)

func main() {
	cfg := config.Load()
	db, err := repository.NewDB(cfg.PostgresURL)
	if err != nil {
		log.Fatalf("db init failed: %v", err)
	}
	if err := repository.InitSchema(db); err != nil {
		log.Fatalf("schema init failed: %v", err)
	}

	userSvc := services.NewUserService(db)
	r := routes.NewRouter(cfg, userSvc)
	if err := r.Run("0.0.0.0:" + cfg.Port); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
