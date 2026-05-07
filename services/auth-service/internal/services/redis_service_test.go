package services

import (
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/stretchr/testify/assert"
)

func TestRedisServiceSessionLifecycle(t *testing.T) {
	mr, err := miniredis.Run()
	assert.NoError(t, err)
	defer mr.Close()

	svc, err := NewRedisService("redis://" + mr.Addr())
	assert.NoError(t, err)

	token := "token-a"
	assert.NoError(t, svc.SaveSession(token, "u-1"))
	got, err := svc.GetSession(token)
	assert.NoError(t, err)
	assert.Equal(t, "u-1", got)
	assert.NoError(t, svc.DeleteSession(token))
	_, err = svc.GetSession(token)
	assert.Error(t, err)
}

func TestBlacklistDefaultTTLWhenInvalid(t *testing.T) {
	mr, err := miniredis.Run()
	assert.NoError(t, err)
	defer mr.Close()

	svc, err := NewRedisService("redis://" + mr.Addr())
	assert.NoError(t, err)
	assert.NoError(t, svc.BlacklistToken("token-b", -1*time.Second))
}
