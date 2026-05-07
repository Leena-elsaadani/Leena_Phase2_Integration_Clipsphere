package repository

import (
	"user-service/internal/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type UserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
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
	err := r.db.Table("users").Select("id, email, name, avatar, role, created_at").Where("id = ?", id).First(&u).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
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

	var row struct {
		ID     string `json:"id"`
		Email  string `json:"email"`
		Name   string `json:"name"`
		Avatar string `json:"avatar"`
		Role   string `json:"role"`
	}
	res := r.db.Table("users").Where("id = ?", id).Clauses(clause.Returning{}).Updates(updates).Scan(&row)
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected == 0 {
		return nil, nil
	}
	return map[string]any{"id": row.ID, "email": row.Email, "name": row.Name, "avatar": row.Avatar, "role": row.Role}, nil
}

func (r *UserRepository) UpdateRole(id, role string) (map[string]any, error) {
	var row struct {
		ID    string `json:"id"`
		Email string `json:"email"`
		Role  string `json:"role"`
	}
	res := r.db.Table("users").Where("id = ?", id).Clauses(clause.Returning{}).Updates(map[string]any{
		"role":       role,
		"updated_at": gorm.Expr("NOW()"),
	}).Scan(&row)
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected == 0 {
		return nil, nil
	}
	return map[string]any{"id": row.ID, "email": row.Email, "role": row.Role}, nil
}

func (r *UserRepository) DeleteByID(id string) (int64, error) {
	res := r.db.Exec("DELETE FROM users WHERE id = ?", id)
	return res.RowsAffected, res.Error
}

func (r *UserRepository) Search(q string) ([]map[string]any, error) {
	var rows []map[string]any
	like := "%" + q + "%"
	err := r.db.Table("users").Select("id, email, name, avatar").Where("name ILIKE ? OR email ILIKE ?", like, like).Limit(20).Find(&rows).Error
	return rows, err
}
