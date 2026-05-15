package services

import (
	"strconv"
	"user-service/internal/repository"

	"gorm.io/gorm"
)

type UserService struct {
	repo repository.UserRepositoryInterface
}

func NewUserService(db *gorm.DB) *UserService {
	return &UserService{repo: repository.NewUserRepository(db)}
}

// NewUserServiceWithRepo allows dependency injection for testing
func NewUserServiceWithRepo(repo repository.UserRepositoryInterface) *UserService {
	return &UserService{repo: repo}
}

func (s *UserService) ListUsers(q, pageRaw, limitRaw string) (map[string]any, error) {
	page, _ := strconv.Atoi(pageRaw)
	if page == 0 {
		page = 1
	}
	limit, _ := strconv.Atoi(limitRaw)
	if limit == 0 {
		limit = 20
	}
	offset := (page - 1) * limit
	users, err := s.repo.FindAll(q, limit, offset)
	if err != nil {
		return nil, err
	}
	return map[string]any{"users": users, "page": page, "limit": limit}, nil
}

func (s *UserService) GetByID(id string) (any, error) {
	user, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}
	// Return untyped nil when user not found so the handler's
	// "if user == nil" check works correctly. Returning a typed
	// (*models.User)(nil) wrapped in any is NOT equal to nil.
	if user == nil {
		return nil, nil
	}
	return user, nil
}

func (s *UserService) UpdateMe(id string, name, avatar *string) (map[string]any, error) {
	return s.repo.UpdateProfile(id, name, avatar)
}

func (s *UserService) UpdateRole(id, role string) (map[string]any, error) {
	return s.repo.UpdateRole(id, role)
}

func (s *UserService) DeleteByID(id string) (int64, error) {
	return s.repo.DeleteByID(id)
}

func (s *UserService) Search(q string) ([]map[string]any, error) {
	return s.repo.Search(q)
}