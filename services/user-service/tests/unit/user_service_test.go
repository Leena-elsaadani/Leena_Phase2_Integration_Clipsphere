package unit

import (
	"errors"
	"testing"
	"user-service/internal/models"
	"user-service/internal/services"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// unitMockRepo mocks repository.UserRepositoryInterface for the unit package.
// It is distinct from the MockUserRepository in internal/services to avoid conflicts.
type unitMockRepo struct {
	mock.Mock
}

func (m *unitMockRepo) FindAll(search string, limit, offset int) ([]models.User, error) {
	args := m.Called(search, limit, offset)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]models.User), args.Error(1)
}

func (m *unitMockRepo) FindByID(id string) (*models.User, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *unitMockRepo) UpdateProfile(id string, name, avatar *string) (map[string]any, error) {
	args := m.Called(id, name, avatar)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(map[string]any), args.Error(1)
}

func (m *unitMockRepo) UpdateRole(id, role string) (map[string]any, error) {
	args := m.Called(id, role)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(map[string]any), args.Error(1)
}

func (m *unitMockRepo) DeleteByID(id string) (int64, error) {
	args := m.Called(id)
	return args.Get(0).(int64), args.Error(1)
}

func (m *unitMockRepo) Search(q string) ([]map[string]any, error) {
	args := m.Called(q)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]map[string]any), args.Error(1)
}

// ---- ListUsers ----

func TestUnitListUsersDefaultPagination(t *testing.T) {
	repo := new(unitMockRepo)
	// Empty strings → page defaults to 1, limit to 20 → offset = 0
	repo.On("FindAll", "", 20, 0).Return([]models.User{}, nil)

	svc := services.NewUserServiceWithRepo(repo)
	result, err := svc.ListUsers("", "", "")

	assert.NoError(t, err)
	assert.Equal(t, 1, result["page"])
	assert.Equal(t, 20, result["limit"])
	repo.AssertExpectations(t)
}

func TestUnitListUsersCustomPagination(t *testing.T) {
	repo := new(unitMockRepo)
	// page=3, limit=5 → offset = (3-1)*5 = 10
	repo.On("FindAll", "alice", 5, 10).Return([]models.User{
		{ID: "1", Email: "alice@test.com", Name: "Alice", Role: "user"},
	}, nil)

	svc := services.NewUserServiceWithRepo(repo)
	result, err := svc.ListUsers("alice", "3", "5")

	assert.NoError(t, err)
	assert.Equal(t, 3, result["page"])
	assert.Equal(t, 5, result["limit"])
	users := result["users"].([]models.User)
	assert.Len(t, users, 1)
	assert.Equal(t, "alice@test.com", users[0].Email)
	repo.AssertExpectations(t)
}

func TestUnitListUsersError(t *testing.T) {
	repo := new(unitMockRepo)
	repo.On("FindAll", "", 20, 0).Return(nil, errors.New("connection refused"))

	svc := services.NewUserServiceWithRepo(repo)
	result, err := svc.ListUsers("", "", "")

	assert.Error(t, err)
	assert.EqualError(t, err, "connection refused")
	assert.Nil(t, result)
	repo.AssertExpectations(t)
}

// ---- GetByID ----

func TestUnitGetByIDFound(t *testing.T) {
	repo := new(unitMockRepo)
	user := &models.User{ID: "u-1", Email: "bob@test.com", Name: "Bob", Role: "user"}
	repo.On("FindByID", "u-1").Return(user, nil)

	svc := services.NewUserServiceWithRepo(repo)
	result, err := svc.GetByID("u-1")

	assert.NoError(t, err)
	assert.NotNil(t, result)
	got := result.(*models.User)
	assert.Equal(t, "u-1", got.ID)
	assert.Equal(t, "bob@test.com", got.Email)
	repo.AssertExpectations(t)
}

func TestUnitGetByIDNotFound(t *testing.T) {
	repo := new(unitMockRepo)
	// Repo returns nil,nil → service returns nil,nil
	repo.On("FindByID", "nonexistent").Return(nil, nil)

	svc := services.NewUserServiceWithRepo(repo)
	result, err := svc.GetByID("nonexistent")

	assert.NoError(t, err)
	assert.Nil(t, result)
	repo.AssertExpectations(t)
}

func TestUnitGetByIDError(t *testing.T) {
	repo := new(unitMockRepo)
	repo.On("FindByID", "bad-id").Return(nil, errors.New("query failed"))

	svc := services.NewUserServiceWithRepo(repo)
	result, err := svc.GetByID("bad-id")

	assert.Error(t, err)
	assert.EqualError(t, err, "query failed")
	assert.Nil(t, result)
	repo.AssertExpectations(t)
}

// ---- DeleteByID ----

func TestUnitDeleteByIDSuccess(t *testing.T) {
	repo := new(unitMockRepo)
	repo.On("DeleteByID", "u-5").Return(int64(1), nil)

	svc := services.NewUserServiceWithRepo(repo)
	rows, err := svc.DeleteByID("u-5")

	assert.NoError(t, err)
	assert.Equal(t, int64(1), rows)
	repo.AssertExpectations(t)
}

func TestUnitDeleteByIDNotFound(t *testing.T) {
	repo := new(unitMockRepo)
	// 0 rows affected, no error
	repo.On("DeleteByID", "ghost").Return(int64(0), nil)

	svc := services.NewUserServiceWithRepo(repo)
	rows, err := svc.DeleteByID("ghost")

	assert.NoError(t, err)
	assert.Equal(t, int64(0), rows)
	repo.AssertExpectations(t)
}

// ---- Search ----

func TestUnitSearchSuccess(t *testing.T) {
	repo := new(unitMockRepo)
	results := []map[string]any{
		{"id": "u-1", "email": "carol@test.com"},
		{"id": "u-2", "email": "carol2@test.com"},
	}
	repo.On("Search", "carol").Return(results, nil)

	svc := services.NewUserServiceWithRepo(repo)
	got, err := svc.Search("carol")

	assert.NoError(t, err)
	assert.Len(t, got, 2)
	assert.Equal(t, "carol@test.com", got[0]["email"])
	repo.AssertExpectations(t)
}

func TestUnitSearchError(t *testing.T) {
	repo := new(unitMockRepo)
	repo.On("Search", "fail").Return(nil, errors.New("search index unavailable"))

	svc := services.NewUserServiceWithRepo(repo)
	got, err := svc.Search("fail")

	assert.Error(t, err)
	assert.EqualError(t, err, "search index unavailable")
	assert.Nil(t, got)
	repo.AssertExpectations(t)
}
