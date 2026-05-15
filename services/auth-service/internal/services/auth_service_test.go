package services

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"net/http"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"
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

// testOAuthConfig points token exchange at a closed local port so tests fail fast at the exchange
// step after state validation, without calling Google (unit tests only).
func testOAuthConfig() *oauth2.Config {
	return &oauth2.Config{
		ClientID:     "unit-test-client",
		ClientSecret: "unit-test-secret",
		RedirectURL:  "http://localhost/callback",
		Endpoint: oauth2.Endpoint{
			TokenURL: "http://127.0.0.1:1/oauth/token",
		},
	}
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

// TestHandleGoogleCallback_InvalidState verifies that a callback with a state
// not present in Redis is rejected with the expected error message.
func TestHandleGoogleCallback_InvalidState(t *testing.T) {
	mr, err := miniredis.Run()
	assert.NoError(t, err)
	defer mr.Close()

	redisSvc, err := NewRedisService("redis://" + mr.Addr())
	assert.NoError(t, err)

	svc := &AuthService{redis: redisSvc}

	_, _, err = svc.HandleGoogleCallback(context.Background(), "somecode", "doesnotexist")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid or expired OAuth state")
}

// TestHandleGoogleCallback_ValidStateOneTimeUse verifies that a valid state is
// accepted, its Redis key deleted, and that a second call with the same state fails.
func TestHandleGoogleCallback_ValidStateOneTimeUse(t *testing.T) {
	mr, err := miniredis.Run()
	require.NoError(t, err)
	defer mr.Close()

	redisSvc, err := NewRedisService("redis://" + mr.Addr())
	require.NoError(t, err)

	ctx := context.Background()
	testState := "teststate1234abcd"
	key := oauthStateKey(testState)

	require.NoError(t, redisSvc.SetState(ctx, testState, 5*time.Minute))
	_, err = mr.Get(key)
	require.NoError(t, err, "state must exist in Redis before callback")

	svc := &AuthService{
		redis:      redisSvc,
		oauthCfg:   testOAuthConfig(),
		httpClient: &http.Client{Timeout: 50 * time.Millisecond},
	}

	_, _, err = svc.HandleGoogleCallback(ctx, "somecode", testState)

	// State must be removed immediately after successful validation (one-time use).
	_, errKey := mr.Get(key)
	assert.ErrorIs(t, errKey, miniredis.ErrKeyNotFound, "state key must be deleted after first use")

	// First request passed state validation; failure must be downstream (token exchange), not CSRF/state.
	require.Error(t, err)
	assert.Contains(t, err.Error(), "oauth exchange")

	// Second call with the same state must be rejected (replay / double-submit).
	_, _, err2 := svc.HandleGoogleCallback(ctx, "somecode", testState)
	require.Error(t, err2)
	assert.Contains(t, err2.Error(), "invalid or expired OAuth state")
}

// TestGenerateState verifies output length and uniqueness.
func TestGenerateState(t *testing.T) {
	s1, err := generateState()
	require.NoError(t, err)
	s2, err := generateState()
	require.NoError(t, err)

	assert.Len(t, s1, 32, "state must be 32 hex characters")
	assert.Len(t, s2, 32, "state must be 32 hex characters")
	assert.NotEqual(t, s1, s2, "successive states must differ")
}

// TestHandleGoogleCallback_ExpiredOAuthState ensures Redis TTL expiry removes the state key
// so the callback is rejected before any token exchange (miniredis FastForward simulates time).
func TestHandleGoogleCallback_ExpiredOAuthState(t *testing.T) {
	mr, err := miniredis.Run()
	require.NoError(t, err)
	defer mr.Close()

	redisSvc, err := NewRedisService("redis://" + mr.Addr())
	require.NoError(t, err)

	ctx := context.Background()
	testState := "expired-state-test-1"
	require.NoError(t, redisSvc.SetState(ctx, testState, time.Minute))

	mr.FastForward(2 * time.Hour)

	svc := &AuthService{redis: redisSvc}
	_, _, err = svc.HandleGoogleCallback(ctx, "somecode", testState)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "invalid or expired OAuth state")
}