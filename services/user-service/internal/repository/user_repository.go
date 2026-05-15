package repository

import (
	"errors"
	"net"
	"strings"
	"time"

	"user-service/internal/models"

	"database/sql/driver"

	"gorm.io/gorm"
)

type UserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	if sqlDB, err := db.DB(); err == nil {
		sqlDB.SetMaxOpenConns(25)
		sqlDB.SetMaxIdleConns(5)
		sqlDB.SetConnMaxLifetime(5 * time.Minute)
	}
	return &UserRepository{db: db}
}

func (r *UserRepository) withRetry(fn func() error) error {
	backoffs := []time.Duration{100 * time.Millisecond, 200 * time.Millisecond, 400 * time.Millisecond}
	for i, delay := range backoffs {
		err := fn()
		if err == nil {
			return nil
		}
		if !isTransientDBError(err) || i == len(backoffs)-1 {
			return err
		}
		time.Sleep(delay)
	}
	return nil
}

func (r *UserRepository) SaveWithRetry(value any) error {
	return r.withRetry(func() error {
		return r.db.Save(value).Error
	})
}

func isTransientDBError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, driver.ErrBadConn) {
		return true
	}
	var netErr net.Error
	if errors.As(err, &netErr) {
		return netErr.Timeout() || netErr.Temporary()
	}
	lower := strings.ToLower(err.Error())
	return strings.Contains(lower, "connection refused") ||
		strings.Contains(lower, "connection reset") ||
		strings.Contains(lower, "broken pipe")
}

func (r *UserRepository) FindAll(search string, limit, offset int) ([]models.User, error) {
	var users []models.User
	q := r.db.Table("users").Select("id, email, name, avatar, role, created_at")
	if search != "" {
		like := "%" + search + "%"
		q = q.Where("name ILIKE ? OR email ILIKE ?", like, like)
	}
	err := q.Order("created_at DESC").Limit(limit).Offset(offset).Scan(&users).Error
	return users, err
}

func (r *UserRepository) FindByID(id string) (*models.User, error) {
	var u models.User
	err := r.withRetry(func() error {
		return r.db.Table("users").Select("id, email, name, avatar, role, created_at").Where(
			"id = ?", id).First(&u).Error
	})
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &u, nil
}

func (r *UserRepository) UpdateProfile(id string, name, avatar *string) (map[string]any, error) {
	updates := map[string]any{}
	if name != nil {
		updates["name"] = *name
	}
	if avatar != nil {
		updates["avatar"] = *avatar
	}
	if len(updates) == 0 {
		return nil, nil
	}
	updates["updated_at"] = gorm.Expr("NOW()")

	// Split into two queries: Updates then fetch.
	// Chaining .Updates().Scan() with RETURNING causes a reflect panic in GORM
	// because the statement's ReflectValue is unaddressable after Updates executes.
	res := r.db.Table("users").Where("id = ?", id).Updates(updates)
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected == 0 {
		return nil, nil
	}

	var row struct {
		ID     string `json:"id"`
		Email  string `json:"email"`
		Name   string `json:"name"`
		Avatar string `json:"avatar"`
		Role   string `json:"role"`
	}
	if err := r.db.Table("users").
		Select("id, email, name, avatar, role").
		Where("id = ?", id).
		Scan(&row).Error; err != nil {
		return nil, err
	}
	return map[string]any{
		"id":     row.ID,
		"email":  row.Email,
		"name":   row.Name,
		"avatar": row.Avatar,
		"role":   row.Role,
	}, nil
}

func (r *UserRepository) UpdateRole(id, role string) (map[string]any, error) {
	// Same fix: split Updates and fetch into separate queries.
	res := r.db.Table("users").Where("id = ?", id).Updates(map[string]any{
		"role":       role,
		"updated_at": gorm.Expr("NOW()"),
	})
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected == 0 {
		return nil, nil
	}

	var row struct {
		ID    string `json:"id"`
		Email string `json:"email"`
		Role  string `json:"role"`
	}
	if err := r.db.Table("users").
		Select("id, email, role").
		Where("id = ?", id).
		Scan(&row).Error; err != nil {
		return nil, err
	}
	return map[string]any{
		"id":    row.ID,
		"email": row.Email,
		"role":  row.Role,
	}, nil
}

func (r *UserRepository) DeleteByID(id string) (int64, error) {
	res := r.db.Exec("DELETE FROM users WHERE id = ?", id)
	return res.RowsAffected, res.Error
}

func (r *UserRepository) Search(q string) ([]map[string]any, error) {
	var rows []map[string]any
	like := "%" + q + "%"
	err := r.db.Table("users").Select("id, email, name, avatar").
		Where("name ILIKE ? OR email ILIKE ?", like, like).
		Limit(20).Find(&rows).Error
	return rows, err
}