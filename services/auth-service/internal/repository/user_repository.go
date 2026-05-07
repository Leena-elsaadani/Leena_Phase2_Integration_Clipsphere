package repository

import (
	"auth-service/internal/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type UserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) UpsertFromGoogle(googleID, email, name, avatar string) (*models.User, error) {
	user := &models.User{
		GoogleID: googleID,
		Email:    email,
		Name:     name,
		Avatar:   avatar,
	}

	err := r.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "google_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"name", "avatar"}),
	}).Create(user).Error
	if err != nil {
		return nil, err
	}

	if err := r.db.First(user, "google_id = ?", googleID).Error; err != nil {
		return nil, err
	}
	return user, nil
}
