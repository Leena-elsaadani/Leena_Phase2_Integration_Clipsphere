package repository

import (
	"auth-service/internal/models"
	"errors"

	"gorm.io/gorm"
)

type UserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) UpsertFromGoogle(googleID, email, name, avatar string) (*models.User, error) {
	user := &models.User{}

	if err := r.db.First(user, "google_id = ?", googleID).Error; err == nil {
		user.Name = name
		user.Avatar = avatar
		return user, r.db.Save(user).Error
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	if email != "" {
		if err := r.db.First(user, "email = ?", email).Error; err == nil {
			user.GoogleID = &googleID
			user.Name = name
			user.Avatar = avatar
			return user, r.db.Save(user).Error
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
	}

	newUser := &models.User{
		GoogleID: &googleID,
		Email:    email,
		Name:     name,
		Avatar:   avatar,
	}
	if err := r.db.Create(newUser).Error; err != nil {
		return nil, err
	}
	return newUser, nil
}

func (r *UserRepository) UpsertFromGitHub(githubID, email, name, avatar string) (*models.User, error) {
	user := &models.User{}

	if err := r.db.First(user, "github_id = ?", githubID).Error; err == nil {
		user.Name = name
		user.Avatar = avatar
		return user, r.db.Save(user).Error
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	if email != "" {
		if err := r.db.First(user, "email = ?", email).Error; err == nil {
			user.GitHubID = &githubID
			user.Name = name
			user.Avatar = avatar
			return user, r.db.Save(user).Error
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
	}

	newUser := &models.User{
		GitHubID: &githubID,
		Email:    email,
		Name:     name,
		Avatar:   avatar,
	}
	if err := r.db.Create(newUser).Error; err != nil {
		return nil, err
	}
	return newUser, nil
}
