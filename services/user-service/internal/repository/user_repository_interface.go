package repository

import (
	"user-service/internal/models"
)

// UserRepositoryInterface defines the contract for user repository operations
// This interface enables mocking for unit testing while the concrete implementation remains unchanged
type UserRepositoryInterface interface {
	FindAll(search string, limit, offset int) ([]models.User, error)
	FindByID(id string) (*models.User, error)
	UpdateProfile(id string, name, avatar *string) (map[string]any, error)
	UpdateRole(id, role string) (map[string]any, error)
	DeleteByID(id string) (int64, error)
	Search(q string) ([]map[string]any, error)
}
