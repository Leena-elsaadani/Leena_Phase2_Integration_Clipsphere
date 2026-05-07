package services

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"time"

	"github.com/go-redis/redis/v8"
)

type RedisService struct {
	client *redis.Client
	ctx    context.Context
}

func NewRedisService(url string) (*RedisService, error) {
	opt, err := redis.ParseURL(url)
	if err != nil {
		return nil, err
	}
	client := redis.NewClient(opt)
	ctx := context.Background()
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, err
	}
	return &RedisService{client: client, ctx: ctx}, nil
}

func (r *RedisService) SaveSession(token, userID string) error {
	return r.client.Set(r.ctx, "session:"+hashToken(token), userID, time.Hour).Err()
}

func (r *RedisService) GetSession(token string) (string, error) {
	return r.client.Get(r.ctx, "session:"+hashToken(token)).Result()
}

func (r *RedisService) DeleteSession(token string) error {
	return r.client.Del(r.ctx, "session:"+hashToken(token)).Err()
}

func (r *RedisService) BlacklistToken(token string, ttl time.Duration) error {
	if ttl <= 0 {
		ttl = time.Second
	}
	return r.client.Set(r.ctx, "blacklisted:"+hashToken(token), "1", ttl).Err()
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
