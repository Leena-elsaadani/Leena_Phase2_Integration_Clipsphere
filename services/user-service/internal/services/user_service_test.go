package services

import (
	"errors"
	"testing"
	"time"

	"user-service/internal/models"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockUserRepository is a mock implementation of UserRepository for testing
type MockUserRepository struct {
	mock.Mock
}

func (m *MockUserRepository) FindAll(search string, limit, offset int) ([]models.User, error) {
	args := m.Called(search, limit, offset)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]models.User), args.Error(1)
}

func (m *MockUserRepository) FindByID(id string) (*models.User, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserRepository) UpdateProfile(id string, name, avatar *string) (map[string]any, error) {
	args := m.Called(id, name, avatar)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(map[string]any), args.Error(1)
}

func (m *MockUserRepository) UpdateRole(id, role string) (map[string]any, error) {
	args := m.Called(id, role)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(map[string]any), args.Error(1)
}

func (m *MockUserRepository) DeleteByID(id string) (int64, error) {
	args := m.Called(id)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockUserRepository) Search(q string) ([]map[string]any, error) {
	args := m.Called(q)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]map[string]any), args.Error(1)
}

// Helper function to create a test service with mock repository
func createTestService(mockRepo *MockUserRepository) *UserService {
	return NewUserServiceWithRepo(mockRepo)
}

// Helper function to create a test user
func createTestUser(id, email, name, avatar, role string) models.User {
	return models.User{
		ID:        id,
		Email:     email,
		Name:      name,
		Avatar:    avatar,
		Role:      role,
		CreatedAt: time.Now(),
	}
}

// TestListUsers tests the ListUsers service method with various scenarios
func TestListUsers(t *testing.T) {
	tests := []struct {
		name           string
		query          string
		pageRaw        string
		limitRaw       string
		mockSetup      func(*MockUserRepository)
		expectedResult map[string]any
		expectedError  error
	}{
		{
			name:     "successful list with default pagination",
			query:    "",
			pageRaw:  "",
			limitRaw: "",
			mockSetup: func(m *MockUserRepository) {
				users := []models.User{
					createTestUser("1", "user1@example.com", "User 1", "avatar1.jpg", "user"),
					createTestUser("2", "user2@example.com", "User 2", "avatar2.jpg", "user"),
				}
				m.On("FindAll", "", 20, 0).Return(users, nil)
			},
			expectedResult: map[string]any{
				"users": []models.User{
					createTestUser("1", "user1@example.com", "User 1", "avatar1.jpg", "user"),
					createTestUser("2", "user2@example.com", "User 2", "avatar2.jpg", "user"),
				},
				"page":  1,
				"limit": 20,
			},
			expectedError: nil,
		},
		{
			name:     "successful list with custom pagination",
			query:    "",
			pageRaw:  "2",
			limitRaw: "10",
			mockSetup: func(m *MockUserRepository) {
				users := []models.User{
					createTestUser("3", "user3@example.com", "User 3", "avatar3.jpg", "user"),
				}
				m.On("FindAll", "", 10, 10).Return(users, nil)
			},
			expectedResult: map[string]any{
				"users": []models.User{
					createTestUser("3", "user3@example.com", "User 3", "avatar3.jpg", "user"),
				},
				"page":  2,
				"limit": 10,
			},
			expectedError: nil,
		},
		{
			name:     "successful list with search query",
			query:    "john",
			pageRaw:  "1",
			limitRaw: "5",
			mockSetup: func(m *MockUserRepository) {
				users := []models.User{
					createTestUser("4", "john@example.com", "John Doe", "avatar4.jpg", "user"),
				}
				m.On("FindAll", "john", 5, 0).Return(users, nil)
			},
			expectedResult: map[string]any{
				"users": []models.User{
					createTestUser("4", "john@example.com", "John Doe", "avatar4.jpg", "user"),
				},
				"page":  1,
				"limit": 5,
			},
			expectedError: nil,
		},
		{
			name:     "empty result list",
			query:    "",
			pageRaw:  "1",
			limitRaw: "20",
			mockSetup: func(m *MockUserRepository) {
				m.On("FindAll", "", 20, 0).Return([]models.User{}, nil)
			},
			expectedResult: map[string]any{
				"users": []models.User{},
				"page":  1,
				"limit": 20,
			},
			expectedError: nil,
		},
		{
			name:     "invalid page number defaults to 1",
			query:    "",
			pageRaw:  "invalid",
			limitRaw: "10",
			mockSetup: func(m *MockUserRepository) {
				users := []models.User{
					createTestUser("5", "user5@example.com", "User 5", "avatar5.jpg", "user"),
				}
				m.On("FindAll", "", 10, 0).Return(users, nil)
			},
			expectedResult: map[string]any{
				"users": []models.User{
					createTestUser("5", "user5@example.com", "User 5", "avatar5.jpg", "user"),
				},
				"page":  1,
				"limit": 10,
			},
			expectedError: nil,
		},
		{
			name:     "invalid limit number defaults to 20",
			query:    "",
			pageRaw:  "1",
			limitRaw: "invalid",
			mockSetup: func(m *MockUserRepository) {
				users := []models.User{
					createTestUser("6", "user6@example.com", "User 6", "avatar6.jpg", "user"),
				}
				m.On("FindAll", "", 20, 0).Return(users, nil)
			},
			expectedResult: map[string]any{
				"users": []models.User{
					createTestUser("6", "user6@example.com", "User 6", "avatar6.jpg", "user"),
				},
				"page":  1,
				"limit": 20,
			},
			expectedError: nil,
		},
		{
			name:     "repository error",
			query:    "",
			pageRaw:  "1",
			limitRaw: "20",
			mockSetup: func(m *MockUserRepository) {
				m.On("FindAll", "", 20, 0).Return([]models.User(nil), errors.New("database connection failed"))
			},
			expectedResult: nil,
			expectedError:  errors.New("database connection failed"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := new(MockUserRepository)
			tt.mockSetup(mockRepo)

			service := createTestService(mockRepo)
			result, err := service.ListUsers(tt.query, tt.pageRaw, tt.limitRaw)

			if tt.expectedError != nil {
				assert.Error(t, err)
				assert.EqualError(t, err, tt.expectedError.Error())
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedResult["page"], result["page"])
				assert.Equal(t, tt.expectedResult["limit"], result["limit"])
				// Compare user slice field-by-field to avoid timestamp mismatches
				expectedUsers := tt.expectedResult["users"].([]models.User)
				actualUsers := result["users"].([]models.User)
				assert.Equal(t, len(expectedUsers), len(actualUsers))
				for i := range expectedUsers {
					if i < len(actualUsers) {
						assert.Equal(t, expectedUsers[i].ID, actualUsers[i].ID)
						assert.Equal(t, expectedUsers[i].Email, actualUsers[i].Email)
						assert.Equal(t, expectedUsers[i].Name, actualUsers[i].Name)
						assert.Equal(t, expectedUsers[i].Avatar, actualUsers[i].Avatar)
						assert.Equal(t, expectedUsers[i].Role, actualUsers[i].Role)
					}
				}
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

// TestGetByID tests the GetByID service method
func TestGetByID(t *testing.T) {
	tests := []struct {
		name           string
		id             string
		mockSetup      func(*MockUserRepository)
		expectedResult any
		expectedError  error
	}{
		{
			name: "successfully get user by ID",
			id:   "123",
			mockSetup: func(m *MockUserRepository) {
				user := createTestUser("123", "test@example.com", "Test User", "avatar.jpg", "user")
				m.On("FindByID", "123").Return(&user, nil)
			},
			expectedResult: &models.User{
				ID:        "123",
				Email:     "test@example.com",
				Name:      "Test User",
				Avatar:    "avatar.jpg",
				Role:      "user",
				CreatedAt: time.Now(),
			},
			expectedError: nil,
		},
		{
			name: "user not found returns nil",
			id:   "999",
			mockSetup: func(m *MockUserRepository) {
				m.On("FindByID", "999").Return(nil, nil)
			},
			expectedResult: nil,
			expectedError:  nil,
		},
		{
			name: "repository error",
			id:   "123",
			mockSetup: func(m *MockUserRepository) {
				m.On("FindByID", "123").Return(nil, errors.New("database error"))
			},
			expectedResult: nil,
			expectedError:  errors.New("database error"),
		},
		{
			name: "empty ID",
			id:   "",
			mockSetup: func(m *MockUserRepository) {
				m.On("FindByID", "").Return(nil, nil)
			},
			expectedResult: nil,
			expectedError:  nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := new(MockUserRepository)
			tt.mockSetup(mockRepo)

			service := createTestService(mockRepo)
			result, err := service.GetByID(tt.id)

			if tt.expectedError != nil {
				assert.Error(t, err)
				assert.EqualError(t, err, tt.expectedError.Error())
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				if tt.expectedResult == nil {
					assert.Nil(t, result)
				} else {
					assert.NotNil(t, result)
					userResult := result.(*models.User)
					expectedUser := tt.expectedResult.(*models.User)
					assert.Equal(t, expectedUser.ID, userResult.ID)
					assert.Equal(t, expectedUser.Email, userResult.Email)
					assert.Equal(t, expectedUser.Name, userResult.Name)
				}
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

// TestUpdateMe tests the UpdateMe service method
func TestUpdateMe(t *testing.T) {
	tests := []struct {
		name           string
		id             string
		newName        *string // renamed from 'name' to avoid collision with test case name field
		avatar         *string
		mockSetup      func(*MockUserRepository)
		expectedResult map[string]any
		expectedError  error
	}{
		{
			name:    "successfully update name only",
			id:      "123",
			newName: func() *string { s := "New Name"; return &s }(),
			avatar:  nil,
			mockSetup: func(m *MockUserRepository) {
				result := map[string]any{
					"id":     "123",
					"email":  "test@example.com",
					"name":   "New Name",
					"avatar": "old-avatar.jpg",
					"role":   "user",
				}
				m.On("UpdateProfile", "123", mock.AnythingOfType("*string"), (*string)(nil)).Return(result, nil)
			},
			expectedResult: map[string]any{
				"id":     "123",
				"email":  "test@example.com",
				"name":   "New Name",
				"avatar": "old-avatar.jpg",
				"role":   "user",
			},
			expectedError: nil,
		},
		{
			name:    "successfully update avatar only",
			id:      "123",
			newName: nil,
			avatar:  func() *string { s := "new-avatar.jpg"; return &s }(),
			mockSetup: func(m *MockUserRepository) {
				result := map[string]any{
					"id":     "123",
					"email":  "test@example.com",
					"name":   "Test User",
					"avatar": "new-avatar.jpg",
					"role":   "user",
				}
				m.On("UpdateProfile", "123", (*string)(nil), mock.AnythingOfType("*string")).Return(result, nil)
			},
			expectedResult: map[string]any{
				"id":     "123",
				"email":  "test@example.com",
				"name":   "Test User",
				"avatar": "new-avatar.jpg",
				"role":   "user",
			},
			expectedError: nil,
		},
		{
			name:    "successfully update both name and avatar",
			id:      "123",
			newName: func() *string { s := "Updated Name"; return &s }(),
			avatar:  func() *string { s := "updated-avatar.jpg"; return &s }(),
			mockSetup: func(m *MockUserRepository) {
				result := map[string]any{
					"id":     "123",
					"email":  "test@example.com",
					"name":   "Updated Name",
					"avatar": "updated-avatar.jpg",
					"role":   "user",
				}
				m.On("UpdateProfile", "123", mock.AnythingOfType("*string"), mock.AnythingOfType("*string")).Return(result, nil)
			},
			expectedResult: map[string]any{
				"id":     "123",
				"email":  "test@example.com",
				"name":   "Updated Name",
				"avatar": "updated-avatar.jpg",
				"role":   "user",
			},
			expectedError: nil,
		},
		{
			name:    "update with nil values returns nil",
			id:      "123",
			newName: nil,
			avatar:  nil,
			mockSetup: func(m *MockUserRepository) {
				m.On("UpdateProfile", "123", (*string)(nil), (*string)(nil)).Return(nil, nil)
			},
			expectedResult: nil,
			expectedError:  nil,
		},
		{
			name:    "repository error on update",
			id:      "123",
			newName: func() *string { s := "New Name"; return &s }(),
			avatar:  nil,
			mockSetup: func(m *MockUserRepository) {
				m.On("UpdateProfile", "123", mock.AnythingOfType("*string"), (*string)(nil)).Return(nil, errors.New("database constraint violation"))
			},
			expectedResult: nil,
			expectedError:  errors.New("database constraint violation"),
		},
		{
			name:    "user not found on update",
			id:      "999",
			newName: func() *string { s := "New Name"; return &s }(),
			avatar:  nil,
			mockSetup: func(m *MockUserRepository) {
				m.On("UpdateProfile", "999", mock.AnythingOfType("*string"), (*string)(nil)).Return(nil, nil)
			},
			expectedResult: nil,
			expectedError:  nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := new(MockUserRepository)
			tt.mockSetup(mockRepo)

			service := createTestService(mockRepo)
			result, err := service.UpdateMe(tt.id, tt.newName, tt.avatar) // uses tt.newName

			if tt.expectedError != nil {
				assert.Error(t, err)
				assert.EqualError(t, err, tt.expectedError.Error())
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedResult, result)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

// TestUpdateRole tests the UpdateRole service method
func TestUpdateRole(t *testing.T) {
	tests := []struct {
		name           string
		id             string
		role           string
		mockSetup      func(*MockUserRepository)
		expectedResult map[string]any
		expectedError  error
	}{
		{
			name: "successfully update user role to admin",
			id:   "123",
			role: "admin",
			mockSetup: func(m *MockUserRepository) {
				result := map[string]any{
					"id":    "123",
					"email": "test@example.com",
					"role":  "admin",
				}
				m.On("UpdateRole", "123", "admin").Return(result, nil)
			},
			expectedResult: map[string]any{
				"id":    "123",
				"email": "test@example.com",
				"role":  "admin",
			},
			expectedError: nil,
		},
		{
			name: "successfully update user role to moderator",
			id:   "456",
			role: "moderator",
			mockSetup: func(m *MockUserRepository) {
				result := map[string]any{
					"id":    "456",
					"email": "mod@example.com",
					"role":  "moderator",
				}
				m.On("UpdateRole", "456", "moderator").Return(result, nil)
			},
			expectedResult: map[string]any{
				"id":    "456",
				"email": "mod@example.com",
				"role":  "moderator",
			},
			expectedError: nil,
		},
		{
			name: "user not found on role update",
			id:   "999",
			role: "admin",
			mockSetup: func(m *MockUserRepository) {
				m.On("UpdateRole", "999", "admin").Return(nil, nil)
			},
			expectedResult: nil,
			expectedError:  nil,
		},
		{
			name: "repository error on role update",
			id:   "123",
			role: "admin",
			mockSetup: func(m *MockUserRepository) {
				m.On("UpdateRole", "123", "admin").Return(nil, errors.New("foreign key constraint"))
			},
			expectedResult: nil,
			expectedError:  errors.New("foreign key constraint"),
		},
		{
			name: "empty role string",
			id:   "123",
			role: "",
			mockSetup: func(m *MockUserRepository) {
				result := map[string]any{
					"id":    "123",
					"email": "test@example.com",
					"role":  "",
				}
				m.On("UpdateRole", "123", "").Return(result, nil)
			},
			expectedResult: map[string]any{
				"id":    "123",
				"email": "test@example.com",
				"role":  "",
			},
			expectedError: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := new(MockUserRepository)
			tt.mockSetup(mockRepo)

			service := createTestService(mockRepo)
			result, err := service.UpdateRole(tt.id, tt.role)

			if tt.expectedError != nil {
				assert.Error(t, err)
				assert.EqualError(t, err, tt.expectedError.Error())
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedResult, result)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

// TestDeleteByID tests the DeleteByID service method
func TestDeleteByID(t *testing.T) {
	tests := []struct {
		name          string
		id            string
		mockSetup     func(*MockUserRepository)
		expectedRows  int64
		expectedError error
	}{
		{
			name: "successfully delete user",
			id:   "123",
			mockSetup: func(m *MockUserRepository) {
				m.On("DeleteByID", "123").Return(int64(1), nil)
			},
			expectedRows:  1,
			expectedError: nil,
		},
		{
			name: "user not found - zero rows affected",
			id:   "999",
			mockSetup: func(m *MockUserRepository) {
				m.On("DeleteByID", "999").Return(int64(0), nil)
			},
			expectedRows:  0,
			expectedError: nil,
		},
		{
			name: "repository error on delete",
			id:   "123",
			mockSetup: func(m *MockUserRepository) {
				m.On("DeleteByID", "123").Return(int64(0), errors.New("foreign key constraint violation"))
			},
			expectedRows:  0,
			expectedError: errors.New("foreign key constraint violation"),
		},
		{
			name: "delete multiple users (if allowed)",
			id:   "123",
			mockSetup: func(m *MockUserRepository) {
				m.On("DeleteByID", "123").Return(int64(3), nil)
			},
			expectedRows:  3,
			expectedError: nil,
		},
		{
			name: "empty ID",
			id:   "",
			mockSetup: func(m *MockUserRepository) {
				m.On("DeleteByID", "").Return(int64(0), errors.New("invalid ID"))
			},
			expectedRows:  0,
			expectedError: errors.New("invalid ID"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := new(MockUserRepository)
			tt.mockSetup(mockRepo)

			service := createTestService(mockRepo)
			rowsAffected, err := service.DeleteByID(tt.id)

			if tt.expectedError != nil {
				assert.Error(t, err)
				assert.EqualError(t, err, tt.expectedError.Error())
			} else {
				assert.NoError(t, err)
			}
			assert.Equal(t, tt.expectedRows, rowsAffected)

			mockRepo.AssertExpectations(t)
		})
	}
}

// TestSearch tests the Search service method
func TestSearch(t *testing.T) {
	tests := []struct {
		name           string
		query          string
		mockSetup      func(*MockUserRepository)
		expectedResult []map[string]any
		expectedError  error
	}{
		{
			name:  "successful search with results",
			query: "john",
			mockSetup: func(m *MockUserRepository) {
				results := []map[string]any{
					{"id": "1", "email": "john@example.com", "name": "John Doe", "avatar": "john.jpg"},
					{"id": "2", "email": "johnny@example.com", "name": "Johnny Smith", "avatar": "johnny.jpg"},
				}
				m.On("Search", "john").Return(results, nil)
			},
			expectedResult: []map[string]any{
				{"id": "1", "email": "john@example.com", "name": "John Doe", "avatar": "john.jpg"},
				{"id": "2", "email": "johnny@example.com", "name": "Johnny Smith", "avatar": "johnny.jpg"},
			},
			expectedError: nil,
		},
		{
			name:  "search with no results",
			query: "nonexistent",
			mockSetup: func(m *MockUserRepository) {
				m.On("Search", "nonexistent").Return([]map[string]any{}, nil)
			},
			expectedResult: []map[string]any{},
			expectedError:  nil,
		},
		{
			name:  "search by email",
			query: "test@example.com",
			mockSetup: func(m *MockUserRepository) {
				results := []map[string]any{
					{"id": "3", "email": "test@example.com", "name": "Test User", "avatar": "test.jpg"},
				}
				m.On("Search", "test@example.com").Return(results, nil)
			},
			expectedResult: []map[string]any{
				{"id": "3", "email": "test@example.com", "name": "Test User", "avatar": "test.jpg"},
			},
			expectedError: nil,
		},
		{
			name:  "empty search query",
			query: "",
			mockSetup: func(m *MockUserRepository) {
				m.On("Search", "").Return([]map[string]any{}, nil)
			},
			expectedResult: []map[string]any{},
			expectedError:  nil,
		},
		{
			name:  "repository error on search",
			query: "john",
			mockSetup: func(m *MockUserRepository) {
				m.On("Search", "john").Return(nil, errors.New("database timeout"))
			},
			expectedResult: nil,
			expectedError:  errors.New("database timeout"),
		},
		{
			name:  "special characters in query",
			query: "o'brien",
			mockSetup: func(m *MockUserRepository) {
				results := []map[string]any{
					{"id": "4", "email": "obrien@example.com", "name": "O'Brien", "avatar": "obrien.jpg"},
				}
				m.On("Search", "o'brien").Return(results, nil)
			},
			expectedResult: []map[string]any{
				{"id": "4", "email": "obrien@example.com", "name": "O'Brien", "avatar": "obrien.jpg"},
			},
			expectedError: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := new(MockUserRepository)
			tt.mockSetup(mockRepo)

			service := createTestService(mockRepo)
			result, err := service.Search(tt.query)

			if tt.expectedError != nil {
				assert.Error(t, err)
				assert.EqualError(t, err, tt.expectedError.Error())
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedResult, result)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}
