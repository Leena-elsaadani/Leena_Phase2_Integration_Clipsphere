package services

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var redisOperationDurationSeconds = promauto.NewHistogramVec(
	prometheus.HistogramOpts{
		Name:    "redis_operation_duration_seconds",
		Help:    "Duration of Redis operations in seconds",
		Buckets: prometheus.DefBuckets,
	},
	[]string{"operation"},
)

func observeRedisOp(operation string, start time.Time) {
	redisOperationDurationSeconds.WithLabelValues(operation).Observe(time.Since(start).Seconds())
}

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
	start := time.Now()
	defer observeRedisOp("save_session", start)
	return r.client.Set(r.ctx, "session:"+hashToken(token), userID, time.Hour).Err()
}

func (r *RedisService) GetSession(token string) (string, error) {
	start := time.Now()
	defer observeRedisOp("get_session", start)
	return r.client.Get(r.ctx, "session:"+hashToken(token)).Result()
}

func (r *RedisService) DeleteSession(token string) error {
	start := time.Now()
	defer observeRedisOp("delete_session", start)
	return r.client.Del(r.ctx, "session:"+hashToken(token)).Err()
}

func (r *RedisService) BlacklistToken(token string, ttl time.Duration) error {
	start := time.Now()
	defer observeRedisOp("blacklist_token", start)
	if ttl <= 0 {
		ttl = time.Second
	}
	return r.client.Set(r.ctx, "blacklisted:"+hashToken(token), "1", ttl).Err()
}

func (r *RedisService) SetState(ctx context.Context, state string, ttl time.Duration) error {
	return r.client.Set(ctx, oauthStateKey(state), "1", ttl).Err()
}

func (r *RedisService) ConsumeState(ctx context.Context, state string) (bool, error) {
	key := oauthStateKey(state)
	if err := r.client.Get(ctx, key).Err(); err != nil {
		return false, err
	}
	_ = r.client.Del(ctx, key).Err()
	return true, nil
}

func oauthStateKey(state string) string {
	return "oauth_state:" + state
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
