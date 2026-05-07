package models

import "time"

type User struct {
	ID        string    `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	GoogleID  string    `gorm:"column:google_id;unique;not null" json:"google_id"`
	Email     string    `gorm:"unique;not null" json:"email"`
	Name      string    `json:"name"`
	Avatar    string    `json:"avatar"`
	Role      string    `gorm:"not null;default:user" json:"role"`
	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime" json:"created_at"`
}

func (User) TableName() string {
	return "users"
}
