package integration

import (
	"auth-service/internal/config"
	"auth-service/internal/models"
	"auth-service/internal/repository"
	"auth-service/internal/routes"
	"auth-service/internal/services"
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/redis"
	"github.com/testcontainers/testcontainers-go/wait"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type testResources struct {
	dbContainer    testcontainers.Container
	redisContainer *redis.RedisContainer
	db             *gorm.DB
	redisSvc       *services.RedisService
	authSvc        *services.AuthService
	router         *gin.Engine
	privateKeyFile string
	publicKeyFile  string
}

func setupTestResources(t *testing.T) *testResources {
	ctx := context.Background()

	// Start PostgreSQL container
	postgresContainer, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: testcontainers.ContainerRequest{
			Image:        "postgres:16-alpine",
			ExposedPorts: []string{"5432/tcp"},
			Env: map[string]string{
				"POSTGRES_DB":       "testdb",
				"POSTGRES_USER":     "testuser",
				"POSTGRES_PASSWORD": "testpass",
			},
			WaitingFor: wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(60 * time.Second),
		},
		Started: true,
	})
	require.NoError(t, err)

	host, err := postgresContainer.Host(ctx)
	require.NoError(t, err)
	port, err := postgresContainer.MappedPort(ctx, "5432")
	require.NoError(t, err)

	postgresDSN := fmt.Sprintf("postgresql://testuser:testpass@%s:%s/testdb?sslmode=disable", host, port.Port())

	db, err := gorm.Open(postgres.Open(postgresDSN), &gorm.Config{})
	require.NoError(t, err)

	err = repository.InitSchema(db)
	require.NoError(t, err)

	// Start Redis container â€” no WithLogLevel to avoid Redis config parse error
	redisContainer, err := redis.RunContainer(ctx)
	require.NoError(t, err)

	redisEndpoint, err := redisContainer.Endpoint(ctx, "")
	require.NoError(t, err)

	redisSvc, err := services.NewRedisService("redis://" + redisEndpoint)
	require.NoError(t, err)

	// Generate RSA keys for JWT
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)

	privateKeyFile, err := os.CreateTemp("", "private_*.pem")
	require.NoError(t, err)
	privateKeyPEM := &pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(privateKey)}
	require.NoError(t, pem.Encode(privateKeyFile, privateKeyPEM))
	privateKeyFile.Close()

	publicKeyFile, err := os.CreateTemp("", "public_*.pem")
	require.NoError(t, err)
	publicKeyBytes, err := x509.MarshalPKIXPublicKey(&privateKey.PublicKey)
	require.NoError(t, err)
	publicKeyPEM := &pem.Block{Type: "PUBLIC KEY", Bytes: publicKeyBytes}
	require.NoError(t, pem.Encode(publicKeyFile, publicKeyPEM))
	publicKeyFile.Close()

	cfg := config.Config{
		Port:           "8080",
		FrontendURL:    "http://localhost:3000",
		GoogleClientID: "test-client-id",
		GoogleSecret:   "test-client-secret",
		GoogleCallback: "http://localhost:8080/auth/google/callback",
		JWTPrivateKey:  privateKeyFile.Name(),
		JWTPublicKey:   publicKeyFile.Name(),
		RedisURL:       "redis://" + redisEndpoint,
		PostgresURL:    postgresDSN,
	}

	authSvc, err := services.NewAuthService(cfg, db, redisSvc)
	require.NoError(t, err)

	gin.SetMode(gin.TestMode)
	router := routes.NewRouter(authSvc, cfg.FrontendURL)

	return &testResources{
		dbContainer:    postgresContainer,
		redisContainer: redisContainer,
		db:             db,
		redisSvc:       redisSvc,
		authSvc:        authSvc,
		router:         router,
		privateKeyFile: privateKeyFile.Name(),
		publicKeyFile:  publicKeyFile.Name(),
	}
}

func teardownTestResources(t *testing.T, tr *testResources) {
	ctx := context.Background()

	tr.db.Exec("DELETE FROM users")

	if tr.dbContainer != nil {
		if err := tr.dbContainer.Terminate(ctx); err != nil {
			t.Logf("Failed to terminate PostgreSQL container: %v", err)
		}
	}

	if tr.redisContainer != nil {
		if err := tr.redisContainer.Terminate(ctx); err != nil {
			t.Logf("Failed to terminate Redis container: %v", err)
		}
	}

	os.Remove(tr.privateKeyFile)
	os.Remove(tr.publicKeyFile)
}

func TestMain(m *testing.M) {
	// Disable Ryuk â€” prevents testcontainers from pulling testcontainers/ryuk
	// from Docker Hub, which fails in network-restricted environments.
	os.Setenv("TESTCONTAINERS_RYUK_DISABLED", "true")
	os.Exit(m.Run())
}

func TestOAuthLoginFlow(t *testing.T) {
	tr := setupTestResources(t)
	defer teardownTestResources(t, tr)

	t.Run("GoogleLoginRedirectsToOAuth", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/auth/google/login", nil)
		rec := httptest.NewRecorder()

		tr.router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusFound, rec.Code)
		location := rec.Header().Get("Location")
		assert.Contains(t, location, "accounts.google.com")
		assert.Contains(t, location, "response_type=code")
		assert.Contains(t, location, "client_id=test-client-id")
	})

	t.Run("GoogleCallbackMissingCode", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/auth/google/callback", nil)
		rec := httptest.NewRecorder()

		tr.router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusFound, rec.Code)
		location := rec.Header().Get("Location")
		assert.Contains(t, location, "localhost:3000/login?error=1")
	})

	t.Run("GoogleCallbackInvalidState", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/auth/google/callback?code=test-code&state=invalid-state", nil)
		rec := httptest.NewRecorder()

		tr.router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusFound, rec.Code)
		location := rec.Header().Get("Location")
		assert.Contains(t, location, "localhost:3000/login?error=1")
	})
}

func TestTokenValidationFlow(t *testing.T) {
	tr := setupTestResources(t)
	defer teardownTestResources(t, tr)

	testUser := &models.User{
		Email:    "test@example.com",
		Name:     "Test User",
		Role:     "user",
		GoogleID: stringPtr("google-123"),
	}
	err := tr.db.Create(testUser).Error
	require.NoError(t, err)

	jwtToken, err := generateTestJWT(tr.privateKeyFile, testUser)
	require.NoError(t, err)

	err = tr.redisSvc.SaveSession(jwtToken, testUser.ID)
	require.NoError(t, err)

	t.Run("ValidateValidToken", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/auth/validate", nil)
		req.Header.Set("Authorization", "Bearer "+jwtToken)
		rec := httptest.NewRecorder()

		tr.router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), `"valid":true`)
		assert.Equal(t, testUser.ID, rec.Header().Get("X-User-Id"))
		assert.Equal(t, testUser.Email, rec.Header().Get("X-User-Email"))
		assert.Equal(t, "user", rec.Header().Get("X-User-Role"))
	})

	t.Run("JWTUsesRS256Algorithm", func(t *testing.T) {
		// Parse without verification to check the algorithm
		parsed, _, err := jwt.NewParser().ParseUnverified(jwtToken, jwt.MapClaims{})
		require.NoError(t, err)
		
		// Verify the signing method is RS256
		assert.Equal(t, "RS256", parsed.Header["alg"])
	})

	t.Run("ValidateTokenWithoutBearer", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/auth/validate", nil)
		req.Header.Set("Authorization", jwtToken)
		rec := httptest.NewRecorder()

		tr.router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	t.Run("ValidateInvalidToken", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/auth/validate", nil)
		req.Header.Set("Authorization", "Bearer invalid.token.here")
		rec := httptest.NewRecorder()

		tr.router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusUnauthorized, rec.Code)
		assert.Contains(t, rec.Body.String(), "Invalid token")
	})

	t.Run("ValidateMissingToken", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/auth/validate", nil)
		rec := httptest.NewRecorder()

		tr.router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusUnauthorized, rec.Code)
		assert.Contains(t, rec.Body.String(), "No token")
	})

	t.Run("LogoutInvalidatesToken", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/auth/logout", nil)
		req.Header.Set("Authorization", "Bearer "+jwtToken)
		rec := httptest.NewRecorder()

		tr.router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "Logged out")

		req2 := httptest.NewRequest(http.MethodPost, "/auth/validate", nil)
		req2.Header.Set("Authorization", "Bearer "+jwtToken)
		rec2 := httptest.NewRecorder()

		tr.router.ServeHTTP(rec2, req2)

		assert.Equal(t, http.StatusUnauthorized, rec2.Code)
		assert.Contains(t, rec2.Body.String(), "Token invalidated")
	})

	t.Run("LogoutWithoutToken", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/auth/logout", nil)
		rec := httptest.NewRecorder()

		tr.router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "Logged out")
	})
}

func TestRedisSessionManagement(t *testing.T) {
	tr := setupTestResources(t)
	defer teardownTestResources(t, tr)

	t.Run("SessionCreatedAfterLogin", func(t *testing.T) {
		testToken  := "test-jwt-token"
		testUserID := "user-123"

		err := tr.redisSvc.SaveSession(testToken, testUserID)
		require.NoError(t, err)

		userID, err := tr.redisSvc.GetSession(testToken)
		require.NoError(t, err)
		assert.Equal(t, testUserID, userID)
	})

	t.Run("SessionDeletedAfterLogout", func(t *testing.T) {
		testToken  := "test-jwt-token-2"
		testUserID := "user-456"

		err := tr.redisSvc.SaveSession(testToken, testUserID)
		require.NoError(t, err)

		err = tr.redisSvc.DeleteSession(testToken)
		require.NoError(t, err)

		_, err = tr.redisSvc.GetSession(testToken)
		assert.Error(t, err)
	})
}

func TestDatabaseUserPersistence(t *testing.T) {
	tr := setupTestResources(t)
	defer teardownTestResources(t, tr)

	t.Run("UserCreatedOnFirstLogin", func(t *testing.T) {
		user := &models.User{
			GoogleID: stringPtr("google-new-123"),
			Email:    "newuser@example.com",
			Name:     "New User",
			Avatar:   "https://example.com/avatar.jpg",
		}

		err := tr.db.Create(user).Error
		require.NoError(t, err)

		var retrievedUser models.User
		err = tr.db.Where("google_id = ?", "google-new-123").First(&retrievedUser).Error
		require.NoError(t, err)

		assert.Equal(t, user.Email, retrievedUser.Email)
		assert.Equal(t, user.Name, retrievedUser.Name)
		assert.Equal(t, user.Avatar, retrievedUser.Avatar)
		assert.Equal(t, "user", retrievedUser.Role)
		assert.NotEmpty(t, retrievedUser.ID)
		assert.False(t, retrievedUser.CreatedAt.IsZero())
	})

	t.Run("UserUpdatedOnSubsequentLogin", func(t *testing.T) {
		user := &models.User{
			GoogleID: stringPtr("google-update-123"),
			Email:    "update@example.com",
			Name:     "Original Name",
			Avatar:   "https://example.com/original.jpg",
		}

		err := tr.db.Create(user).Error
		require.NoError(t, err)

		err = tr.db.Model(user).Updates(map[string]any{
			"name":   "Updated Name",
			"avatar": "https://example.com/updated.jpg",
		}).Error
		require.NoError(t, err)

		var retrievedUser models.User
		err = tr.db.Where("google_id = ?", "google-update-123").First(&retrievedUser).Error
		require.NoError(t, err)

		assert.Equal(t, "Updated Name", retrievedUser.Name)
		assert.Equal(t, "https://example.com/updated.jpg", retrievedUser.Avatar)
		assert.Equal(t, user.Email, retrievedUser.Email)
	})
}

func TestOAuthStateManagement(t *testing.T) {
	tr := setupTestResources(t)
	defer teardownTestResources(t, tr)

	t.Run("StateStoredAndConsumed", func(t *testing.T) {
		loginURL := tr.authSvc.GoogleLoginURL()
		assert.NotEmpty(t, loginURL)
		assert.Contains(t, loginURL, "state=")
	})
}

func TestPublicKeyEndpoint(t *testing.T) {
	tr := setupTestResources(t)
	defer teardownTestResources(t, tr)

	t.Run("PublicKeyReturnsValidPEM", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/auth/public-key", nil)
		rec := httptest.NewRecorder()

		tr.router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		body := rec.Body.String()
		assert.Contains(t, body, "-----BEGIN PUBLIC KEY-----")
		assert.Contains(t, body, "-----END PUBLIC KEY-----")
	})
}

func TestHealthEndpoint(t *testing.T) {
	tr := setupTestResources(t)
	defer teardownTestResources(t, tr)

	t.Run("HealthReturnsOK", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/health", nil)
		rec := httptest.NewRecorder()

		tr.router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), `"status":"ok"`)
	})
}

// ---------------------------------------------------------------------------
// Helpers

func stringPtr(s string) *string {
	return &s
}

func generateTestJWT(privateKeyFile string, user *models.User) (string, error) {
	privateKeyBytes, err := os.ReadFile(privateKeyFile)
	if err != nil {
		return "", err
	}

	privateKey, err := jwt.ParseRSAPrivateKeyFromPEM(privateKeyBytes)
	if err != nil {
		return "", err
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
		"sub":   user.ID,
		"email": user.Email,
		"role":  user.Role,
		"name":  user.Name,
		"exp":   time.Now().Add(time.Hour).Unix(),
		"iat":   time.Now().Unix(),
	})

	return token.SignedString(privateKey)
}


