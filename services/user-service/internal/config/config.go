package config

import (
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port         string
	PostgresURL  string
	JWTPublicKey string
}

func Load() Config {
	_ = godotenv.Load()
	return Config{
		Port:         getEnv("PORT", "3003"),
		PostgresURL:  getEnv("POSTGRES_URL", "postgresql://admin:secret@localhost:5432/appdb"),
		JWTPublicKey: getEnv("JWT_PUBLIC_KEY_PATH", "./keys/public.pem"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
