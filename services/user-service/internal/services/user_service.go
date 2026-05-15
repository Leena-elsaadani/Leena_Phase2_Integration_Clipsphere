package services

import (
	"strconv"
	"user-service/internal/repository"

	"gorm.io/gorm"
)

type UserService struct {
	repo *repository.UserRepository
}

func NewUserService(db *gorm.DB) *UserService {
	return &UserService{repo: repository.NewUserRepository(db)}
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

func (s *UserService) GetProfile(id string) (any, error) {
	return s.repo.FindByID(id)
}

func (s *UserService) UpdateProfile(id string, name, avatar *string) (map[string]any, error) {
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

func (s *UserService) SearchUsers(query string, limit, offset int) ([]map[string]any, int64, error) {
	users, err := s.repo.FindAll(query, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	result := make([]map[string]any, 0, len(users))
	for _, u := range users {
		result = append(result, map[string]any{
			"id":         u.ID,
			"email":      u.Email,
			"name":       u.Name,
			"avatarUrl":  u.Avatar,
			"role":       u.Role,
			"created_at": u.CreatedAt,
		})
	}
	return result, int64(len(result)), nil
}
