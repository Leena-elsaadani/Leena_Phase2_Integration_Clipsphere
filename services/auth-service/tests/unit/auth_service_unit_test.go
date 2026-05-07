package unit

import (
	"auth-service/internal/services"
	"crypto/sha256"
	"encoding/hex"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
)

func signedTestToken(t *testing.T, exp time.Time) string {
	t.Helper()
	claims := jwt.MapClaims{
		"sub":   "u-1",
		"email": "u@test.com",
		"role":  "user",
		"exp":   exp.Unix(),
		"iat":   time.Now().Unix(),
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	out, err := tok.SignedString([]byte("test-secret"))
	assert.NoError(t, err)
	return out
}

func TestRedisBlacklistWriteAndSessionFlow(t *testing.T) {
	mr, err := miniredis.Run()
	assert.NoError(t, err)
	defer mr.Close()

	redisSvc, err := services.NewRedisService("redis://" + mr.Addr())
	assert.NoError(t, err)

	token := signedTestToken(t, time.Now().Add(45*time.Minute))
	err = redisSvc.SaveSession(token, "u-1")
	assert.NoError(t, err)

	got, err := redisSvc.GetSession(token)
	assert.NoError(t, err)
	assert.Equal(t, "u-1", got)

	err = redisSvc.BlacklistToken(token, 30*time.Minute)
	assert.NoError(t, err)

	sum := sha256.Sum256([]byte(token))
	hash := hex.EncodeToString(sum[:])
	assert.True(t, mr.Exists("blacklisted:"+hash))
}
