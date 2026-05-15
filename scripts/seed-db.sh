#!/bin/sh
# seed-db.sh
# Seeds the database with an initial admin user and sample data.
# Idempotent — safe to run multiple times (uses INSERT ... ON CONFLICT DO NOTHING).
# Usage: ./infrastructure/scripts/seed-db.sh

set -e

DB_URL=${POSTGRES_URL:-"postgresql://admin:secret@localhost:5432/appdb"}
MONGO_URL=${MONGODB_URL:-"mongodb://localhost:27017/chatdb"}

echo "================================================"
echo " Database Seeder — $(date)"
echo "================================================"

# ── PostgreSQL: seed admin user ───────────────────────────────────────────────
echo ""
echo "[PostgreSQL] Seeding users table..."

psql "$DB_URL" << 'SQL'
-- Create the users table if it doesn't exist yet
CREATE TABLE IF NOT EXISTS users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id  TEXT UNIQUE,
  email      TEXT UNIQUE NOT NULL,
  name       TEXT,
  avatar     TEXT,
  role       TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed a test admin user (google_id is NULL — for testing only)
INSERT INTO users (google_id, email, name, role)
VALUES
  ('google-admin-seed-001', 'admin@example.com',   'Admin User',    'admin'),
  ('google-user-seed-001',  'alice@example.com',   'Alice Example', 'user'),
  ('google-user-seed-002',  'bob@example.com',     'Bob Example',   'user')
ON CONFLICT (google_id) DO NOTHING;

SELECT id, email, role FROM users ORDER BY created_at;
SQL

echo "[PostgreSQL] Done."

# ── MongoDB: seed chat rooms ──────────────────────────────────────────────────
echo ""
echo "[MongoDB] Seeding chat rooms..."

mongosh "$MONGO_URL" --quiet << 'MONGO'
// Create rooms collection with sample rooms
db.rooms.createIndex({ name: 1 }, { unique: true });

db.rooms.insertMany([
  { name: "general",    description: "General discussion",      createdAt: new Date() },
  { name: "random",     description: "Off-topic conversations", createdAt: new Date() },
  { name: "tech-talk",  description: "Engineering discussions", createdAt: new Date() }
], { ordered: false });

print("Rooms seeded: " + db.rooms.countDocuments());

// Create messages index for fast pagination
db.messages.createIndex({ roomId: 1, createdAt: -1 });
print("Message index created.");
MONGO

echo "[MongoDB] Done."
echo ""
echo "================================================"
echo " Seeding complete ✓"
echo "================================================"