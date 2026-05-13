package repository

import (
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func NewDB(dsn string) (*gorm.DB, error) {
	return gorm.Open(postgres.Open(dsn), &gorm.Config{})
}

func InitSchema(db *gorm.DB) error {
	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      google_id  TEXT UNIQUE,
      github_id  TEXT UNIQUE,
      email      TEXT UNIQUE NOT NULL,
      name       TEXT,
      avatar     TEXT,
      role       TEXT NOT NULL DEFAULT 'user',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).Error; err != nil {
			return err
		}

		if err := tx.Exec(`ALTER TABLE users ALTER COLUMN google_id DROP NOT NULL`).Error; err != nil {
			return err
		}

		if err := tx.Exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS github_id TEXT`).Error; err != nil {
			return err
		}

		if err := tx.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS users_github_id_key ON users(github_id)`).Error; err != nil {
			return err
		}

		return nil
	})
}
