package integration

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"user-service/internal/config"
	"user-service/internal/models"
	"user-service/internal/repository"
	"user-service/internal/routes"
	"user-service/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"os"
)

type testResources struct {
	dbContainer testcontainers.Container
	db          *gorm.DB
	userSvc     *services.UserService
	router      *gin.Engine
}

func setupTestResources(t *testing.T) *testResources {
	ctx := context.Background()

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

	cfg := config.Config{
		Port:        "8080",
		PostgresURL: postgresDSN,
	}

	userSvc := services.NewUserService(db)

	gin.SetMode(gin.TestMode)
	router := routes.NewRouter(cfg, userSvc)

	return &testResources{
		dbContainer: postgresContainer,
		db:          db,
		userSvc:     userSvc,
		router:      router,
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
}

func TestMain(m *testing.M) {
	os.Setenv("TESTCONTAINERS_RYUK_DISABLED", "true")
	os.Exit(m.Run())
}

// setAuthHeaders sets the trusted identity headers the gateway injects.
// The middleware reads X-User-Id, X-User-Role, X-User-Email — not a Bearer token.
func setAuthHeaders(req *http.Request, user *models.User) {
	req.Header.Set("X-User-Id", user.ID)
	req.Header.Set("X-User-Role", user.Role)
	req.Header.Set("X-User-Email", user.Email)
}

// Test A: Create User (via database — no POST /users endpoint exists)
func TestCreateUser(t *testing.T) {
	tr := setupTestResources(t)
	defer teardownTestResources(t, tr)

	t.Run("CreateUserInDatabase", func(t *testing.T) {
		user := &models.User{
			Email:    "test@example.com",
			Name:     "Test User",
			Avatar:   "https://example.com/avatar.jpg",
			Role:     "user",
			GoogleID: stringPtr("google-123"),
		}

		err := tr.db.Create(user).Error
		require.NoError(t, err)

		var retrievedUser models.User
		err = tr.db.Where("email = ?", "test@example.com").First(&retrievedUser).Error
		require.NoError(t, err)

		assert.Equal(t, user.Email, retrievedUser.Email)
		assert.Equal(t, user.Name, retrievedUser.Name)
		assert.Equal(t, user.Avatar, retrievedUser.Avatar)
		assert.Equal(t, user.Role, retrievedUser.Role)
		assert.NotEmpty(t, retrievedUser.ID)
		assert.NotZero(t, retrievedUser.CreatedAt)
		assert.NotZero(t, retrievedUser.UpdatedAt)
	})
}

// Test B: Get User Profile
func TestGetUser(t *testing.T) {
	tr := setupTestResources(t)
	defer teardownTestResources(t, tr)

	t.Run("GetUserByID", func(t *testing.T) {
		user := &models.User{
			Email:  "getbyid@example.com",
			Name:   "Get By ID User",
			Avatar: "https://example.com/avatar.jpg",
			Role:   "user",
		}
		err := tr.db.Create(user).Error
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/users/"+user.ID, nil)
		setAuthHeaders(req, user)
		rec := httptest.NewRecorder()

		tr.router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), `"email":"getbyid@example.com"`)
		assert.Contains(t, rec.Body.String(), `"name":"Get By ID User"`)
		assert.Contains(t, rec.Body.String(), `"role":"user"`)

		var dbUser models.User
		err = tr.db.Where("id = ?", user.ID).First(&dbUser).Error
		require.NoError(t, err)
		assert.Equal(t, user.Email, dbUser.Email)
		assert.Equal(t, user.Name, dbUser.Name)
	})

	t.Run("GetUserMe", func(t *testing.T) {
		user := &models.User{
			Email:  "getme@example.com",
			Name:   "Get Me User",
			Avatar: "https://example.com/me.jpg",
			Role:   "user",
		}
		err := tr.db.Create(user).Error
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/users/me", nil)
		setAuthHeaders(req, user)
		rec := httptest.NewRecorder()

		tr.router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), `"email":"getme@example.com"`)
		assert.Contains(t, rec.Body.String(), `"name":"Get Me User"`)

		var dbUser models.User
		err = tr.db.Where("id = ?", user.ID).First(&dbUser).Error
		require.NoError(t, err)
		assert.Equal(t, user.Email, dbUser.Email)
	})

	t.Run("GetUserNotFound", func(t *testing.T) {
		// Use a real user for auth headers but request a non-existent ID
		authUser := &models.User{
			ID:    "00000000-0000-0000-0000-000000000001",
			Email: "notfound@example.com",
			Name:  "Not Found User",
			Role:  "user",
		}

		req := httptest.NewRequest(http.MethodGet, "/users/00000000-0000-0000-0000-000000000099", nil)
		setAuthHeaders(req, authUser)
		rec := httptest.NewRecorder()

		tr.router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusNotFound, rec.Code)
		assert.Contains(t, rec.Body.String(), "User not found")
	})
}

// Test C: Update User
func TestUpdateUser(t *testing.T) {
	tr := setupTestResources(t)
	defer teardownTestResources(t, tr)

	t.Run("UpdateUserProfile", func(t *testing.T) {
		user := &models.User{
			Email:  "update@example.com",
			Name:   "Original Name",
			Avatar: "https://example.com/original.jpg",
			Role:   "user",
		}
		err := tr.db.Create(user).Error
		require.NoError(t, err)

		updatePayload := `{"name":"Updated Name","avatar":"https://example.com/updated.jpg"}`
		req := httptest.NewRequest(http.MethodPatch, "/users/me", strings.NewReader(updatePayload))
		setAuthHeaders(req, user)
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		tr.router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), `"name":"Updated Name"`)
		assert.Contains(t, rec.Body.String(), `"avatar":"https://example.com/updated.jpg"`)

		var dbUser models.User
		err = tr.db.Where("id = ?", user.ID).First(&dbUser).Error
		require.NoError(t, err)
		assert.Equal(t, "Updated Name", dbUser.Name)
		assert.Equal(t, "https://example.com/updated.jpg", dbUser.Avatar)
	})

	t.Run("UpdateUserNameOnly", func(t *testing.T) {
		user := &models.User{
			Email:  "updatename@example.com",
			Name:   "Original Name",
			Avatar: "https://example.com/original.jpg",
			Role:   "user",
		}
		err := tr.db.Create(user).Error
		require.NoError(t, err)

		updatePayload := `{"name":"Name Only Update"}`
		req := httptest.NewRequest(http.MethodPatch, "/users/me", strings.NewReader(updatePayload))
		setAuthHeaders(req, user)
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		tr.router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), `"name":"Name Only Update"`)

		var dbUser models.User
		err = tr.db.Where("id = ?", user.ID).First(&dbUser).Error
		require.NoError(t, err)
		assert.Equal(t, "Name Only Update", dbUser.Name)
		assert.Equal(t, "https://example.com/original.jpg", dbUser.Avatar)
	})

	t.Run("UpdateUserRole", func(t *testing.T) {
		adminUser := &models.User{
			Email: "admin@example.com",
			Name:  "Admin User",
			Role:  "admin",
		}
		err := tr.db.Create(adminUser).Error
		require.NoError(t, err)

		targetUser := &models.User{
			Email: "target@example.com",
			Name:  "Target User",
			Role:  "user",
		}
		err = tr.db.Create(targetUser).Error
		require.NoError(t, err)

		updatePayload := `{"role":"admin"}`
		req := httptest.NewRequest(http.MethodPatch, "/users/"+targetUser.ID+"/role", strings.NewReader(updatePayload))
		setAuthHeaders(req, adminUser)
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		tr.router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), `"role":"admin"`)

		var dbUser models.User
		err = tr.db.Where("id = ?", targetUser.ID).First(&dbUser).Error
		require.NoError(t, err)
		assert.Equal(t, "admin", dbUser.Role)
	})

	t.Run("UpdateUserProfileNoFields", func(t *testing.T) {
		user := &models.User{
			Email: "nofields@example.com",
			Name:  "No Fields User",
			Role:  "user",
		}
		err := tr.db.Create(user).Error
		require.NoError(t, err)

		updatePayload := `{}`
		req := httptest.NewRequest(http.MethodPatch, "/users/me", strings.NewReader(updatePayload))
		setAuthHeaders(req, user)
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		tr.router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
		assert.Contains(t, rec.Body.String(), "No fields to update")
	})
}

// Test D: Delete User
func TestDeleteUser(t *testing.T) {
	tr := setupTestResources(t)
	defer teardownTestResources(t, tr)

	t.Run("DeleteUser", func(t *testing.T) {
		adminUser := &models.User{
			Email: "admin-delete@example.com",
			Name:  "Admin Delete User",
			Role:  "admin",
		}
		err := tr.db.Create(adminUser).Error
		require.NoError(t, err)

		targetUser := &models.User{
			Email: "delete-target@example.com",
			Name:  "Delete Target User",
			Role:  "user",
		}
		err = tr.db.Create(targetUser).Error
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodDelete, "/users/"+targetUser.ID, nil)
		setAuthHeaders(req, adminUser)
		rec := httptest.NewRecorder()

		tr.router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusNoContent, rec.Code)

		var dbUser models.User
		err = tr.db.Where("id = ?", targetUser.ID).First(&dbUser).Error
		assert.Error(t, err)
		assert.Equal(t, gorm.ErrRecordNotFound, err)
	})

	t.Run("DeleteUserNotFound", func(t *testing.T) {
		adminUser := &models.User{
			Email: "admin-notfound@example.com",
			Name:  "Admin Not Found",
			Role:  "admin",
		}
		err := tr.db.Create(adminUser).Error
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodDelete, "/users/00000000-0000-0000-0000-000000000099", nil)
		setAuthHeaders(req, adminUser)
		rec := httptest.NewRecorder()

		tr.router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusNotFound, rec.Code)
		assert.Contains(t, rec.Body.String(), "User not found")
	})

	t.Run("DeleteUserThenVerifyGone", func(t *testing.T) {
		adminUser := &models.User{
			Email: "admin-verify@example.com",
			Name:  "Admin Verify",
			Role:  "admin",
		}
		err := tr.db.Create(adminUser).Error
		require.NoError(t, err)

		targetUser := &models.User{
			Email: "verify-delete@example.com",
			Name:  "Verify Delete",
			Role:  "user",
		}
		err = tr.db.Create(targetUser).Error
		require.NoError(t, err)

		// Delete
		req := httptest.NewRequest(http.MethodDelete, "/users/"+targetUser.ID, nil)
		setAuthHeaders(req, adminUser)
		rec := httptest.NewRecorder()
		tr.router.ServeHTTP(rec, req)
		assert.Equal(t, http.StatusNoContent, rec.Code)

		// Verify gone
		getReq := httptest.NewRequest(http.MethodGet, "/users/"+targetUser.ID, nil)
		setAuthHeaders(getReq, adminUser)
		getRec := httptest.NewRecorder()
		tr.router.ServeHTTP(getRec, getReq)

		assert.Equal(t, http.StatusNotFound, getRec.Code)
	})
}

func stringPtr(s string) *string {
	return &s
}