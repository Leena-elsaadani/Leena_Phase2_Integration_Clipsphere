package config

import (
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port             string
	GoogleClientID   string
	GoogleSecret     string
	GoogleCallback   string
	JWTPrivateKey    string
	JWTPublicKey     string
	RedisURL         string
	PostgresURL      string
}

func Load() Config {
	_ = godotenv.Load()

	return Config{
		Port:           getEnv("PORT", "3001"),
		GoogleClientID: os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleSecret:   os.Getenv("GOOGLE_CLIENT_SECRET"),
		GoogleCallback: os.Getenv("GOOGLE_CALLBACK_URL"),
		JWTPrivateKey:  getEnv("JWT_PRIVATE_KEY_PATH", "./keys/private.pem"),
		JWTPublicKey:   getEnv("JWT_PUBLIC_KEY_PATH", "./keys/public.pem"),
		RedisURL:       getEnv("REDIS_URL", "redis://localhost:6379"),
		PostgresURL:    getEnv("POSTGRES_URL", "postgresql://admin:secret@localhost:5432/appdb"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
