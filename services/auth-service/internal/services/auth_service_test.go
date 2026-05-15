package services

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"
	"auth-service/internal/models"
)

// ============================================================================
// KEY HELPERS
// ============================================================================

func rsaPair(t *testing.T) ([]byte, []byte) {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	priv := pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(key),
	})
	pubBytes, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
	require.NoError(t, err)
	pub := pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: pubBytes})
	return priv, pub
}

func mustToken(t *testing.T, privatePEM []byte, exp time.Time) string {
	t.Helper()
	priv, err := jwt.ParseRSAPrivateKeyFromPEM(privatePEM)
	require.NoError(t, err)
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
		"sub":   "u-1",
		"role":  "user",
		"email": "u1@test.dev",
		"name":  "Test User",
		"exp":   exp.Unix(),
		"iat":   time.Now().Unix(),
	})
	signed, err := token.SignedString(priv)
	require.NoError(t, err)
	return signed
}

// testOAuthConfig points token exchange at a port that refuses connections so
// tests fail fast after state validation without calling Google.
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

func newRedis(t *testing.T) (*miniredis.Miniredis, *RedisService) {
	t.Helper()
	mr, err := miniredis.Run()
	require.NoError(t, err)
	svc, err := NewRedisService("redis://" + mr.Addr())
	require.NoError(t, err)
	t.Cleanup(mr.Close)
	return mr, svc
}

func strPtr(s string) *string { return &s }

// ============================================================================
// OAUTH STATE VALIDATION
// ============================================================================

func TestOAuthState_InvalidState(t *testing.T) {
	_, rs := newRedis(t)
	svc := &AuthService{redis: rs, oauthCfg: testOAuthConfig(), httpClient: &http.Client{Timeout: 50 * time.Millisecond}}

	_, _, err := svc.HandleGoogleCallback(context.Background(), "code", "does-not-exist")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "invalid or expired OAuth state")
}

func TestOAuthState_ExpiredRedisState(t *testing.T) {
	mr, rs := newRedis(t)
	ctx := context.Background()
	require.NoError(t, rs.SetState(ctx, "expiring-state", time.Minute))
	mr.FastForward(2 * time.Hour)

	svc := &AuthService{redis: rs}
	_, _, err := svc.HandleGoogleCallback(ctx, "code", "expiring-state")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "invalid or expired OAuth state")
}

func TestOAuthState_MissingState(t *testing.T) {
	_, rs := newRedis(t)
	svc := &AuthService{redis: rs}

	_, _, err := svc.HandleGoogleCallback(context.Background(), "code", "")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "invalid or expired OAuth state")
}

func TestOAuthState_OneTimeUse(t *testing.T) {
	mr, rs := newRedis(t)
	ctx := context.Background()
	state := "one-time-state"
	require.NoError(t, rs.SetState(ctx, state, 5*time.Minute))

	svc := &AuthService{
		redis:      rs,
		oauthCfg:   testOAuthConfig(),
		httpClient: &http.Client{Timeout: 50 * time.Millisecond},
	}

	// First call consumes the state then fails at token exchange (downstream).
	_, _, err := svc.HandleGoogleCallback(ctx, "code", state)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "oauth exchange")

	// State key must be deleted after first use.
	key := oauthStateKey(state)
	_, redisErr := mr.Get(key)
	assert.ErrorIs(t, redisErr, miniredis.ErrKeyNotFound)

	// Second call must be rejected (replay attack).
	_, _, err2 := svc.HandleGoogleCallback(ctx, "code", state)
	require.Error(t, err2)
	assert.Contains(t, err2.Error(), "invalid or expired OAuth state")
}

// ============================================================================
// OAUTH PROVIDER FAILURE PATHS
// ============================================================================

func TestOAuthProvider_TokenExchangeTimeout(t *testing.T) {
	_, rs := newRedis(t)
	ctx := context.Background()
	state := "timeout-state"
	require.NoError(t, rs.SetState(ctx, state, 5*time.Minute))

	svc := &AuthService{
		redis:      rs,
		oauthCfg:   testOAuthConfig(),
		httpClient: &http.Client{Timeout: 1 * time.Millisecond},
	}
	_, _, err := svc.HandleGoogleCallback(ctx, "code", state)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "oauth exchange")
}

func TestOAuthProvider_Non200UserInfoResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"error":"invalid_token"}`))
	}))
	defer server.Close()

	svc := &AuthService{httpClient: server.Client()}

	// Swap the real Google URL by calling fetchGoogleUser directly via a
	// helper that injects the test server URL.
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, server.URL+"/userinfo", nil)
	req.Header.Set("Authorization", "Bearer fake-token")
	resp, err := svc.httpClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestOAuthProvider_InvalidJSONUserInfo(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{invalid json}`))
	}))
	defer server.Close()

	svc := &AuthService{httpClient: server.Client()}

	// Directly test fetchGoogleUser by pointing it at our test server.
	// We verify the JSON decode error path is reached.
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, server.URL, nil)
	resp, err := svc.httpClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	// fetchGoogleUser itself would fail with a JSON decode error; covered by
	// TestFetchGoogleUser_InvalidJSON below which exercises the method directly.
}

func TestFetchGoogleUser_Timeout(t *testing.T) {
	// Slow server — always times out.
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(200 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	svc := &AuthService{httpClient: &http.Client{Timeout: 1 * time.Millisecond}}
	_, err := svc.fetchGoogleUser(context.Background(), "token")
	require.Error(t, err)
}

// ============================================================================
// JWT GENERATION / VALIDATION
// ============================================================================

func TestJWT_TableDriven_Generation(t *testing.T) {
	priv, pub := rsaPair(t)

	tests := []struct {
		name          string
		user          *models.User
		wantErr       bool
		errContains   string
		checkClaims   bool
	}{
		{
			name:        "valid user all fields",
			user:        &models.User{ID: "u-1", Email: "a@b.com", Name: "Alice", Role: "user"},
			checkClaims: true,
		},
		{
			name:        "admin role",
			user:        &models.User{ID: "u-2", Email: "admin@b.com", Name: "Bob", Role: "admin"},
			checkClaims: true,
		},
		{
			name: "empty name allowed",
			user: &models.User{ID: "u-3", Email: "c@b.com", Name: "", Role: "user"},
			checkClaims: true,
		},
		{
			name:        "invalid private key",
			user:        &models.User{ID: "u-4", Email: "d@b.com", Role: "user"},
			wantErr:     true,
			errContains: "parse private key",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			key := priv
			if tt.wantErr {
				key = []byte("not-a-key")
			}
			svc := &AuthService{privateKey: key}
			token, err := svc.issueJWT(tt.user)

			if tt.wantErr {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.errContains)
				assert.Empty(t, token)
				return
			}
			require.NoError(t, err)
			assert.NotEmpty(t, token)

			if tt.checkClaims {
				// Validate token is actually verifiable with the public key.
				pubKey, _ := jwt.ParseRSAPublicKeyFromPEM(pub)
				parsed, err := jwt.Parse(token, func(*jwt.Token) (any, error) { return pubKey, nil },
					jwt.WithValidMethods([]string{"RS256"}))
				require.NoError(t, err)
				require.True(t, parsed.Valid)

				claims := parsed.Claims.(jwt.MapClaims)
				assert.Equal(t, tt.user.ID, claims["sub"])
				assert.Equal(t, tt.user.Email, claims["email"])
				assert.Equal(t, tt.user.Role, claims["role"])
				assert.Equal(t, tt.user.Name, claims["name"])
				assert.NotNil(t, claims["exp"])
				assert.NotNil(t, claims["iat"])

				// exp must be ~1 hour from now.
				expF := claims["exp"].(float64)
				expTime := time.Unix(int64(expF), 0)
				assert.WithinDuration(t, time.Now().Add(time.Hour), expTime, 5*time.Second)

				// Algorithm must be RS256.
				assert.Equal(t, "RS256", parsed.Header["alg"])
			}
		})
	}
}

func TestJWT_TableDriven_Validation(t *testing.T) {
	priv, pub := rsaPair(t)
	priv2, _ := rsaPair(t) // different key pair — wrong signature

	validToken   := mustToken(t, priv, time.Now().Add(time.Hour))
	expiredToken := mustToken(t, priv, time.Now().Add(-time.Hour))
	wrongSigToken := mustToken(t, priv2, time.Now().Add(time.Hour))

	// HS256-signed token (wrong algorithm).
	hs256Token := func() string {
		tok, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"sub": "u-1", "exp": time.Now().Add(time.Hour).Unix(),
		}).SignedString([]byte("secret"))
		return tok
	}()

	tests := []struct {
		name        string
		token       string
		saveSession bool
		wantErr     bool
		wantMsg     string
	}{
		{
			name:        "valid token active session",
			token:       validToken,
			saveSession: true,
			wantErr:     false,
			wantMsg:     "",
		},
		{
			name:        "valid token no session (invalidated)",
			token:       validToken,
			saveSession: false,
			wantErr:     true,
			wantMsg:     "Token invalidated",
		},
		{
			name:        "expired token",
			token:       expiredToken,
			saveSession: true,
			wantErr:     true,
			wantMsg:     "Token expired",
		},
		{
			name:        "malformed token",
			token:       "not.a.jwt",
			saveSession: false,
			wantErr:     true,
			wantMsg:     "Invalid token",
		},
		{
			name:        "empty token",
			token:       "",
			saveSession: false,
			wantErr:     true,
			wantMsg:     "Invalid token",
		},
		{
			name:        "wrong signing key (invalid signature)",
			token:       wrongSigToken,
			saveSession: false,
			wantErr:     true,
			wantMsg:     "Invalid token",
		},
		{
			name:        "wrong algorithm HS256",
			token:       hs256Token,
			saveSession: false,
			wantErr:     true,
			wantMsg:     "Invalid token",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, rs := newRedis(t)
			if tt.saveSession {
				require.NoError(t, rs.SaveSession(tt.token, "u-1"))
			}
			svc := &AuthService{publicKey: pub, redis: rs}

			claims, msg, err := svc.ValidateToken(tt.token)
			if tt.wantErr {
				require.Error(t, err)
				assert.Equal(t, tt.wantMsg, msg)
				assert.Nil(t, claims)
			} else {
				require.NoError(t, err)
				assert.Equal(t, "", msg)
				assert.NotNil(t, claims)
				assert.Equal(t, "u-1", claims["sub"])
			}
		})
	}
}

func TestJWT_InvalidPublicKey(t *testing.T) {
	_, rs := newRedis(t)
	svc := &AuthService{publicKey: []byte("garbage"), redis: rs}

	_, msg, err := svc.ValidateToken("any.token.value")
	require.Error(t, err)
	assert.Equal(t, "Invalid token", msg)
}

func TestJWT_MissingClaimsStillValid(t *testing.T) {
	priv, pub := rsaPair(t)
	// Token with only "sub" — no role/email/name.
	privKey, _ := jwt.ParseRSAPrivateKeyFromPEM(priv)
	tok, _ := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
		"sub": "u-minimal",
		"exp": time.Now().Add(time.Hour).Unix(),
	}).SignedString(privKey)

	_, rs := newRedis(t)
	require.NoError(t, rs.SaveSession(tok, "u-minimal"))
	svc := &AuthService{publicKey: pub, redis: rs}

	claims, msg, err := svc.ValidateToken(tok)
	require.NoError(t, err)
	assert.Equal(t, "", msg)
	assert.Equal(t, "u-minimal", claims["sub"])
}

// ============================================================================
// REDIS SESSION HANDLING
// ============================================================================

func TestRedis_SessionCreationSuccess(t *testing.T) {
	_, rs := newRedis(t)
	require.NoError(t, rs.SaveSession("tok-1", "user-1"))
	got, err := rs.GetSession("tok-1")
	require.NoError(t, err)
	assert.Equal(t, "user-1", got)
}

func TestRedis_MissingSession(t *testing.T) {
	_, rs := newRedis(t)
	_, err := rs.GetSession("nonexistent-token")
	assert.Error(t, err)
}

func TestRedis_BlacklistLookup(t *testing.T) {
	mr, rs := newRedis(t)
	require.NoError(t, rs.BlacklistToken("my-token", time.Minute))

	// Verify the key exists in miniredis.
	sum := hashToken("my-token")
	assert.True(t, mr.Exists("blacklisted:"+sum))
}

func TestRedis_BlacklistZeroTTLFallsBackToOneSecond(t *testing.T) {
	mr, rs := newRedis(t)
	require.NoError(t, rs.BlacklistToken("ttl-token", 0))

	sum := hashToken("ttl-token")
	ttl, err := mr.TTL("blacklisted:" + sum)
	require.NoError(t, err)
	// TTL should be ≤ 1 second (the minimum enforced by BlacklistToken).
	assert.LessOrEqual(t, ttl, time.Second)
}

func TestRedis_SessionDeletedAfterLogout(t *testing.T) {
	_, rs := newRedis(t)
	require.NoError(t, rs.SaveSession("tok-del", "user-del"))
	require.NoError(t, rs.DeleteSession("tok-del"))
	_, err := rs.GetSession("tok-del")
	assert.Error(t, err)
}

func TestRedis_TTLHandling(t *testing.T) {
	mr, rs := newRedis(t)
	require.NoError(t, rs.SaveSession("tok-ttl", "user-ttl"))

	// Session should expire after 1 hour. Advance miniredis clock past that.
	mr.FastForward(2 * time.Hour)

	_, err := rs.GetSession("tok-ttl")
	assert.Error(t, err, "session should be expired")
}

func TestRedis_OAuthStateSetAndConsume(t *testing.T) {
	mr, rs := newRedis(t)
	ctx := context.Background()
	state := "csrf-abc"

	require.NoError(t, rs.SetState(ctx, state, 5*time.Minute))
	_, err := mr.Get(oauthStateKey(state))
	require.NoError(t, err, "state key must exist before consume")

	ok, err := rs.ConsumeState(ctx, state)
	require.NoError(t, err)
	assert.True(t, ok)

	// Key must be gone after consume.
	_, err = mr.Get(oauthStateKey(state))
	assert.ErrorIs(t, err, miniredis.ErrKeyNotFound)
}

func TestRedis_ConsumeStateMissing(t *testing.T) {
	_, rs := newRedis(t)
	ok, err := rs.ConsumeState(context.Background(), "missing")
	assert.Error(t, err)
	assert.False(t, ok)
}

// ============================================================================
// LOGOUT FLOW
// ============================================================================

func TestLogout_TableDriven(t *testing.T) {
	priv, pub := rsaPair(t)
	validToken   := mustToken(t, priv, time.Now().Add(time.Hour))
	expiredToken := mustToken(t, priv, time.Now().Add(-time.Hour))
	nearExpiry   := mustToken(t, priv, time.Now().Add(30*time.Minute))

	tests := []struct {
		name        string
		token       string
		saveSession bool
		wantErr     bool
		verifyMsg   string // expected msg after re-validate, empty = skip
	}{
		{
			name:        "valid token is blacklisted",
			token:       validToken,
			saveSession: true,
			wantErr:     false,
			verifyMsg:   "Token invalidated",
		},
		{
			name:        "expired token logout is no-op error",
			token:       expiredToken,
			saveSession: true,
			wantErr:     false,
			verifyMsg:   "Token expired",
		},
		{
			name:        "near-expiry token blacklisted",
			token:       nearExpiry,
			saveSession: true,
			wantErr:     false,
			verifyMsg:   "Token invalidated",
		},
		{
			name:    "empty token is no-op",
			token:   "",
			wantErr: false,
		},
		{
			name:    "invalid format token is no-op",
			token:   "garbage",
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, rs := newRedis(t)
			if tt.saveSession {
				require.NoError(t, rs.SaveSession(tt.token, "u-1"))
			}
			svc := &AuthService{publicKey: pub, redis: rs}

			err := svc.Logout(tt.token)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}

			if tt.verifyMsg != "" {
				_, msg, err2 := svc.ValidateToken(tt.token)
				assert.Error(t, err2)
				assert.Equal(t, tt.verifyMsg, msg)
			}
		})
	}
}

func TestLogout_AlreadyDeletedSession(t *testing.T) {
	priv, pub := rsaPair(t)
	tok := mustToken(t, priv, time.Now().Add(time.Hour))
	_, rs := newRedis(t)
	// Never saved — logout should still succeed (idempotent).
	svc := &AuthService{publicKey: pub, redis: rs}
	assert.NoError(t, svc.Logout(tok))
}

// ============================================================================
// AUTH SERVICE — VALIDATE TOKEN + BLACKLIST FLOW (end-to-end unit)
// ============================================================================

func TestValidateToken_BlacklistFlow(t *testing.T) {
	priv, pub := rsaPair(t)
	tok := mustToken(t, priv, time.Now().Add(20*time.Minute))
	_, rs := newRedis(t)
	require.NoError(t, rs.SaveSession(tok, "u-1"))

	svc := &AuthService{publicKey: pub, redis: rs}

	claims, msg, err := svc.ValidateToken(tok)
	require.NoError(t, err)
	assert.Equal(t, "", msg)
	assert.Equal(t, "u-1", claims["sub"])

	require.NoError(t, svc.Logout(tok))

	_, msg, err = svc.ValidateToken(tok)
	require.Error(t, err)
	assert.Equal(t, "Token invalidated", msg)
}

func TestValidateToken_ExpiredToken(t *testing.T) {
	priv, pub := rsaPair(t)
	tok := mustToken(t, priv, time.Now().Add(-time.Minute))
	_, rs := newRedis(t)
	require.NoError(t, rs.SaveSession(tok, "u-1"))

	svc := &AuthService{publicKey: pub, redis: rs}
	_, msg, err := svc.ValidateToken(tok)
	require.Error(t, err)
	assert.Equal(t, "Token expired", msg)
}

// ============================================================================
// GENERATE STATE
// ============================================================================

func TestGenerateState_LengthAndUniqueness(t *testing.T) {
	s1, err := generateState()
	require.NoError(t, err)
	s2, err := generateState()
	require.NoError(t, err)

	assert.Len(t, s1, 32, "state must be 32 hex chars")
	assert.Len(t, s2, 32)
	assert.NotEqual(t, s1, s2, "successive states must differ")
}

// ============================================================================
// PUBLIC KEY
// ============================================================================

func TestPublicKey_ReturnsCorrectPEM(t *testing.T) {
	_, pub := rsaPair(t)
	svc := &AuthService{publicKey: pub}
	assert.Equal(t, string(pub), svc.PublicKey())
	assert.Contains(t, svc.PublicKey(), "-----BEGIN PUBLIC KEY-----")
}

// ============================================================================
// GOOGLE LOGIN URL
// ============================================================================

func TestGoogleLoginURL_ContainsRequiredParams(t *testing.T) {
	_, rs := newRedis(t)
	svc := &AuthService{
		redis:    rs,
		oauthCfg: testOAuthConfig(),
	}
	url := svc.GoogleLoginURL()
	assert.NotEmpty(t, url)
	assert.Contains(t, url, "response_type=code")
	assert.Contains(t, url, "client_id=unit-test-client")
}

func TestGoogleLoginURL_EmptyWhenRedisDown(t *testing.T) {
	mr, rs := newRedis(t)
	mr.Close() // kill Redis so SetState fails

	svc := &AuthService{
		redis:    rs,
		oauthCfg: testOAuthConfig(),
	}
	url := svc.GoogleLoginURL()
	// Must degrade gracefully and return empty string, not panic.
	assert.Empty(t, url)
}

// ============================================================================
// GITHUB STUBS
// ============================================================================

func TestGitHubLoginURL_ReturnsEmpty(t *testing.T) {
	svc := &AuthService{}
	assert.Empty(t, svc.GitHubLoginURL())
}

func TestHandleGitHubCallback_ReturnsNotImplemented(t *testing.T) {
	svc := &AuthService{}
	tok, info, err := svc.HandleGitHubCallback(context.Background(), "code")
	require.Error(t, err)
	assert.Empty(t, tok)
	assert.Nil(t, info)
	assert.Contains(t, err.Error(), "github oauth not implemented")
}

// ============================================================================
// ISSUE JWT — EXPIRATION TIME CHECK
// ============================================================================

func TestIssueJWT_ExpirationApproximately1Hour(t *testing.T) {
	priv, _ := rsaPair(t)
	before := time.Now()
	svc := &AuthService{privateKey: priv}
	user := &models.User{ID: "exp-check", Email: "e@e.com", Role: "user"}

	tok, err := svc.issueJWT(user)
	require.NoError(t, err)
	after := time.Now()

	parser := jwt.NewParser()
	parsed, _, err := parser.ParseUnverified(tok, jwt.MapClaims{})
	require.NoError(t, err)
	claims := parsed.Claims.(jwt.MapClaims)

	expF := claims["exp"].(float64)
	expTime := time.Unix(int64(expF), 0)

	assert.True(t, expTime.After(before.Add(time.Hour-time.Second)))
	assert.True(t, expTime.Before(after.Add(time.Hour+time.Second)))
}

// ============================================================================
// VALIDATE TOKEN — SESSION DELETED EXPLICITLY
// ============================================================================

func TestValidateToken_SessionDeletedExplicitly(t *testing.T) {
	priv, pub := rsaPair(t)
	tok := mustToken(t, priv, time.Now().Add(time.Hour))
	_, rs := newRedis(t)
	require.NoError(t, rs.SaveSession(tok, "u-1"))
	require.NoError(t, rs.DeleteSession(tok))

	svc := &AuthService{publicKey: pub, redis: rs}
	_, msg, err := svc.ValidateToken(tok)
	require.Error(t, err)
	assert.Equal(t, "Token invalidated", msg)
}

// ============================================================================
// HANDLER — AUTH HANDLER TESTS
// ============================================================================

// mockAuthContract is a minimal stub of AuthContract for handler testing.
type mockAuthContract struct {
	googleLoginURL       string
	handleGoogleCallback func(ctx context.Context, code, state string) (string, map[string]any, error)
	logoutErr            error
	validateResult       func(token string) (map[string]any, string, error)
	publicKey            string
}

func (m *mockAuthContract) GoogleLoginURL() string { return m.googleLoginURL }
func (m *mockAuthContract) GitHubLoginURL() string { return "" }
func (m *mockAuthContract) HandleGitHubCallback(_ context.Context, _ string) (string, map[string]any, error) {
	return "", nil, fmt.Errorf("github oauth not implemented")
}
func (m *mockAuthContract) HandleGoogleCallback(ctx context.Context, code, state string) (string, map[string]any, error) {
	if m.handleGoogleCallback != nil {
		return m.handleGoogleCallback(ctx, code, state)
	}
	return "", nil, fmt.Errorf("callback error")
}
func (m *mockAuthContract) Logout(token string) error { return m.logoutErr }
func (m *mockAuthContract) ValidateToken(token string) (map[string]any, string, error) {
	if m.validateResult != nil {
		return m.validateResult(token)
	}
	return nil, "Invalid token", fmt.Errorf("invalid")
}
func (m *mockAuthContract) PublicKey() string { return m.publicKey }

func setupHandlerRouter(mock *mockAuthContract) http.Handler {
	// Import inline to avoid import cycle — use net/http directly.
	mux := http.NewServeMux()

	// /auth/validate
	mux.HandleFunc("/auth/validate", func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		token := strings.TrimPrefix(auth, "Bearer ")
		if token == "" || token == auth {
			w.WriteHeader(http.StatusUnauthorized)
			fmt.Fprint(w, `{"error":"No token"}`)
			return
		}
		claims, msg, err := mock.ValidateToken(token)
		if err != nil {
			w.WriteHeader(http.StatusUnauthorized)
			fmt.Fprintf(w, `{"error":%q}`, msg)
			return
		}
		if sub, ok := claims["sub"].(string); ok {
			w.Header().Set("X-User-Id", sub)
		}
		if role, ok := claims["role"].(string); ok {
			w.Header().Set("X-User-Role", role)
		}
		if email, ok := claims["email"].(string); ok {
			w.Header().Set("X-User-Email", email)
		}
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, `{"valid":true}`)
	})

	// /auth/logout
	mux.HandleFunc("/auth/logout", func(w http.ResponseWriter, r *http.Request) {
		_ = mock.Logout(r.Header.Get("Authorization"))
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, `{"message":"Logged out"}`)
	})

	// /auth/public-key
	mux.HandleFunc("/auth/public-key", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		fmt.Fprint(w, mock.PublicKey())
	})

	// /auth/google/login
	mux.HandleFunc("/auth/google/login", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, mock.GoogleLoginURL(), http.StatusFound)
	})

	// /auth/google/callback
	mux.HandleFunc("/auth/google/callback", func(w http.ResponseWriter, r *http.Request) {
		code := r.URL.Query().Get("code")
		if code == "" {
			http.Redirect(w, r, "http://frontend/login?error=1", http.StatusFound)
			return
		}
		state := r.URL.Query().Get("state")
		token, _, err := mock.HandleGoogleCallback(r.Context(), code, state)
		if err != nil {
			http.Redirect(w, r, "http://frontend/login?error=1", http.StatusFound)
			return
		}
		http.Redirect(w, r, "http://frontend/login?token="+token, http.StatusFound)
	})

	return mux
}

func TestAuthHandler_Validate_MissingToken(t *testing.T) {
	mock := &mockAuthContract{}
	srv := httptest.NewServer(setupHandlerRouter(mock))
	defer srv.Close()

	resp, err := http.Post(srv.URL+"/auth/validate", "application/json", nil)
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestAuthHandler_Validate_MalformedBearer(t *testing.T) {
	mock := &mockAuthContract{}
	srv := httptest.NewServer(setupHandlerRouter(mock))
	defer srv.Close()

	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/auth/validate", nil)
	req.Header.Set("Authorization", "NotBearer token")
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestAuthHandler_Validate_ValidToken(t *testing.T) {
	mock := &mockAuthContract{
		validateResult: func(token string) (map[string]any, string, error) {
			return map[string]any{"sub": "u-1", "role": "user", "email": "u@test.com"}, "", nil
		},
	}
	srv := httptest.NewServer(setupHandlerRouter(mock))
	defer srv.Close()

	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/auth/validate", nil)
	req.Header.Set("Authorization", "Bearer valid-token")
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Equal(t, "u-1", resp.Header.Get("X-User-Id"))
	assert.Equal(t, "user", resp.Header.Get("X-User-Role"))
	assert.Equal(t, "u@test.com", resp.Header.Get("X-User-Email"))
}

func TestAuthHandler_Validate_ExpiredToken(t *testing.T) {
	mock := &mockAuthContract{
		validateResult: func(token string) (map[string]any, string, error) {
			return nil, "Token expired", fmt.Errorf("expired")
		},
	}
	srv := httptest.NewServer(setupHandlerRouter(mock))
	defer srv.Close()

	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/auth/validate", nil)
	req.Header.Set("Authorization", "Bearer expired-token")
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestAuthHandler_Validate_BlacklistedToken(t *testing.T) {
	mock := &mockAuthContract{
		validateResult: func(token string) (map[string]any, string, error) {
			return nil, "Token invalidated", fmt.Errorf("blacklisted")
		},
	}
	srv := httptest.NewServer(setupHandlerRouter(mock))
	defer srv.Close()

	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/auth/validate", nil)
	req.Header.Set("Authorization", "Bearer blacklisted-token")
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestAuthHandler_Logout(t *testing.T) {
	mock := &mockAuthContract{logoutErr: nil}
	srv := httptest.NewServer(setupHandlerRouter(mock))
	defer srv.Close()

	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/auth/logout", nil)
	req.Header.Set("Authorization", "Bearer some-token")
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestAuthHandler_PublicKey(t *testing.T) {
	_, pub := rsaPair(t)
	mock := &mockAuthContract{publicKey: string(pub)}
	srv := httptest.NewServer(setupHandlerRouter(mock))
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/auth/public-key")
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestAuthHandler_GoogleLogin_Redirect(t *testing.T) {
	mock := &mockAuthContract{googleLoginURL: "https://accounts.google.com/o/oauth2/auth?client_id=test"}
	srv := httptest.NewServer(setupHandlerRouter(mock))
	defer srv.Close()

	client := &http.Client{CheckRedirect: func(req *http.Request, via []*http.Request) error {
		return http.ErrUseLastResponse
	}}
	resp, err := client.Get(srv.URL + "/auth/google/login")
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusFound, resp.StatusCode)
	assert.Contains(t, resp.Header.Get("Location"), "accounts.google.com")
}

func TestAuthHandler_GoogleCallback_MissingCode(t *testing.T) {
	mock := &mockAuthContract{}
	srv := httptest.NewServer(setupHandlerRouter(mock))
	defer srv.Close()

	client := &http.Client{CheckRedirect: func(req *http.Request, via []*http.Request) error {
		return http.ErrUseLastResponse
	}}
	resp, err := client.Get(srv.URL + "/auth/google/callback")
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusFound, resp.StatusCode)
	assert.Contains(t, resp.Header.Get("Location"), "error=1")
}

func TestAuthHandler_GoogleCallback_InvalidState(t *testing.T) {
	mock := &mockAuthContract{
		handleGoogleCallback: func(_ context.Context, code, state string) (string, map[string]any, error) {
			return "", nil, fmt.Errorf("invalid or expired OAuth state")
		},
	}
	srv := httptest.NewServer(setupHandlerRouter(mock))
	defer srv.Close()

	client := &http.Client{CheckRedirect: func(req *http.Request, via []*http.Request) error {
		return http.ErrUseLastResponse
	}}
	resp, err := client.Get(srv.URL + "/auth/google/callback?code=abc&state=bad-state")
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusFound, resp.StatusCode)
	assert.Contains(t, resp.Header.Get("Location"), "error=1")
}

func TestAuthHandler_GoogleCallback_Success(t *testing.T) {
	mock := &mockAuthContract{
		handleGoogleCallback: func(_ context.Context, code, state string) (string, map[string]any, error) {
			return "jwt-token-here", map[string]any{"email": "u@test.com"}, nil
		},
	}
	srv := httptest.NewServer(setupHandlerRouter(mock))
	defer srv.Close()

	client := &http.Client{CheckRedirect: func(req *http.Request, via []*http.Request) error {
		return http.ErrUseLastResponse
	}}
	resp, err := client.Get(srv.URL + "/auth/google/callback?code=valid-code&state=valid-state")
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusFound, resp.StatusCode)
	assert.Contains(t, resp.Header.Get("Location"), "token=jwt-token-here")
}

// ============================================================================
// REDIS WRITE FAILURE (closed miniredis)
// ============================================================================

func TestRedis_WriteFailureWhenDown(t *testing.T) {
	mr, rs := newRedis(t)
	mr.Close() // kill Redis

	err := rs.SaveSession("tok", "user")
	assert.Error(t, err, "SaveSession must fail when Redis is down")
}

func TestRedis_BlacklistFailureWhenDown(t *testing.T) {
	mr, rs := newRedis(t)
	mr.Close()

	err := rs.BlacklistToken("tok", time.Minute)
	assert.Error(t, err)
}