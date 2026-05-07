package services

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
)

func mustToken(t *testing.T, privatePEM []byte, exp time.Time) string {
	t.Helper()
	priv, err := jwt.ParseRSAPrivateKeyFromPEM(privatePEM)
	assert.NoError(t, err)
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
		"sub":   "u-1",
		"role":  "user",
		"email": "u1@test.dev",
		"exp":   exp.Unix(),
		"iat":   time.Now().Unix(),
	})
	signed, err := token.SignedString(priv)
	assert.NoError(t, err)
	return signed
}

func rsaPair(t *testing.T) ([]byte, []byte) {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	assert.NoError(t, err)
	priv := pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)})
	pubBytes, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
	assert.NoError(t, err)
	pub := pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: pubBytes})
	return priv, pub
}

func TestValidateTokenAndLogoutBlacklistFlow(t *testing.T) {
	priv, pub := rsaPair(t)
	mr, err := miniredis.Run()
	assert.NoError(t, err)
	defer mr.Close()
	redisSvc, err := NewRedisService("redis://" + mr.Addr())
	assert.NoError(t, err)

	token := mustToken(t, priv, time.Now().Add(20*time.Minute))
	assert.NoError(t, redisSvc.SaveSession(token, "u-1"))

	svc := &AuthService{publicKey: pub, redis: redisSvc}

	claims, msg, err := svc.ValidateToken(token)
	assert.NoError(t, err)
	assert.Equal(t, "", msg)
	assert.Equal(t, "u-1", claims["sub"])

	assert.NoError(t, svc.Logout(token))
	_, msg, err = svc.ValidateToken(token)
	assert.Error(t, err)
	assert.Equal(t, "Token invalidated", msg)
}

func TestValidateTokenExpired(t *testing.T) {
	priv, pub := rsaPair(t)
	mr, err := miniredis.Run()
	assert.NoError(t, err)
	defer mr.Close()
	redisSvc, err := NewRedisService("redis://" + mr.Addr())
	assert.NoError(t, err)

	token := mustToken(t, priv, time.Now().Add(-1*time.Minute))
	assert.NoError(t, redisSvc.SaveSession(token, "u-1"))
	svc := &AuthService{publicKey: pub, redis: redisSvc}

	_, msg, err := svc.ValidateToken(token)
	assert.Error(t, err)
	assert.Equal(t, "Token expired", msg)
}
