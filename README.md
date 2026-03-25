# ClipSphere — Phase 1: Backend Foundations & Security

> **SWAPD352 Web Development · Spring 2026**  
> Zewail City of Science, Technology and Innovation  
> University of Science and Technology  
> School of Computational Sciences and Artificial Intelligence

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Team Members](#team-members)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Architecture: Three-Layer Design](#architecture)
6. [Database Collections & ER Diagram](#database)
7. [API Endpoints Reference](#api-endpoints)
8. [Security Features](#security-features)
9. [Setup & Installation](#setup)
10. [Running the Project](#running)
11. [Testing with Postman](#testing)
12. [Environment Variables](#env-variables)
13. [Phase Roadmap](#roadmap)

---

## Project Overview

ClipSphere is a high-performance, short-video social platform built as a full-stack ecosystem. Phase 1 establishes the complete backend API including secure authentication, role-based access control, a social graph system, media metadata management, and an admin oversight layer.

The platform allows users to register, share short videos (≤ 5 minutes), follow each other, leave star-rated reviews, and receive in-app or email notifications — all governed by a strict permission model differentiating standard users from admins.

---

## Team Members

| Member | Responsibility |
|--------|---------------|
| Member 1 — Leena | User authentication system, JWT middleware, User schema, Zod validation, logging, error handling, Swagger docs |
| Member 2 — Maya | RBAC middleware, ownership middleware, followers system, notification preferences |
| Member 3 | Video/Review schemas, media endpoints, review system, admin analytics, admin RBAC endpoints |

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | Node.js (ES Modules) | Server-side JavaScript |
| Framework | Express.js v5 | HTTP routing and middleware |
| Database | MongoDB | NoSQL document storage |
| ODM | Mongoose v9 | Schema definition and query building |
| Authentication | JSON Web Tokens (JWT) | Stateless auth, 24h expiry |
| Password Security | Bcrypt (salt factor 10) | One-way password hashing |
| Input Validation | Zod v4 | Schema-based request validation |
| Request Logging | Morgan | HTTP request logging |
| NoSQL Injection Prevention | express-mongo-sanitize | Strips $ and . from inputs |
| API Documentation | Swagger UI (swagger-jsdoc + swagger-ui-express) | Interactive docs at /api-docs |
| Dev Server | Nodemon | Auto-restart on file changes |

---

## Project Structure

```
ClipSphere/
└── backend/
    └── src/
        ├── app.js                    Express app setup, middleware registration
        ├── server.js                 Entry point — starts HTTP server
        ├── config/
        │   ├── db.js                 MongoDB connection (Mongoose)
        │   └── env.js                Environment variable loader
        ├── constants/
        │   └── roles.js              Role constants: "user", "admin"
        ├── controllers/
        │   ├── auth.controller.js    Register, login
        │   ├── user.controller.js    Profile, follow/unfollow
        │   ├── video.controller.js   CRUD + reviews
        │   └── admin.controller.js   Stats, moderation, health check
        ├── middleware/
        │   ├── auth.middleware.js     JWT verification (protect)
        │   ├── role.middleware.js     Role restriction (restrictTo)
        │   ├── ownership.middleware.js  Owner vs admin access check
        │   ├── validate.middleware.js   Zod schema wrapper
        │   ├── error.middleware.js      Global async error handler
        │   └── logger.middleware.js     Morgan request logging
        ├── models/
        │   ├── user.model.js         User schema with roles and notification prefs
        │   ├── video.model.js        Video schema with status and duration
        │   ├── review.model.js       Review schema with compound unique index
        │   └── follower.model.js     Follower schema with self-follow prevention
        ├── routes/
        │   ├── auth.routes.js        POST /register, POST /login
        │   ├── user.routes.js        GET/PATCH /me, follow, preferences
        │   ├── video.routes.js       CRUD /videos, POST /videos/:id/reviews
        │   └── admin.routes.js       GET /stats, /moderation, /health, PATCH /users/:id/status
        ├── services/
        │   ├── auth.service.js       Registration and login logic
        │   ├── user.service.js       Profile management, social graph
        │   ├── video.service.js      Video CRUD business logic
        │   ├── review.service.js     Review creation with duplicate check
        │   └── admin.service.js      Aggregation pipelines, health check
        ├── validators/
        │   └── video.validator.js    Zod schemas: video, review, admin status
        ├── utils/
        │   ├── ApiError.js           Custom error class with HTTP status codes
        │   ├── jwt.js                JWT sign/verify utilities
        │   └── logger.js             Winston or custom logger
        └── docs/
            └── swagger.js            OpenAPI spec configuration
```

---

## Architecture: Three-Layer Design

Every request follows this strict path:

```
Client (Postman / Browser)
        │
        ▼
   Routes layer          → Maps URL + HTTP method to middleware chain
        │
        ▼
   Middleware chain       → auth.middleware → validate → ownership
        │
        ▼
   Controllers layer      → Extracts req data, calls service, sends response
        │
        ▼
   Services layer         → All business logic and database operations
        │
        ▼
   Models / MongoDB        → Schema enforcement, index constraints
```

**Why three layers?**
- Routes know nothing about logic — just routing
- Controllers know nothing about data — just HTTP
- Services know nothing about HTTP — just business rules
- Changing a database query only touches the service layer
- Adding caching later only requires modifying one service function

---

## Database Collections & ER Diagram

### Relationships Summary

| Relationship | Type | Description |
|---|---|---|
| User → Video | One-to-many | One user uploads many videos (via Video.owner) |
| User → Review | One-to-many | One user writes many reviews (via Review.user) |
| Video → Review | One-to-many | One video receives many reviews (via Review.video) |
| User → Follower (as followed) | One-to-many | A user can have many followers (via Follower.followingId) |
| User → Follower (as follower) | One-to-many | A user can follow many others (via Follower.followerId) |

### Compound Unique Indexes

| Collection | Index | Constraint |
|---|---|---|
| Review | `{ user: 1, video: 1 }` | One review per user per video — enforced at DB level |
| Follower | `{ followerId: 1, followingId: 1 }` | No duplicate follows — enforced at DB level |

### Pre-save Hook

The Follower schema includes a pre-save hook that rejects any document where `followerId === followingId`, preventing self-follow at the application layer before the database write.

---

## API Endpoints Reference

### Authentication (Member 1)

| Method | Endpoint | Auth | Description |
|--------|---------|------|-------------|
| POST | `/api/v1/auth/register` | Public | Create account — Zod validation, Bcrypt hashing |
| POST | `/api/v1/auth/login` | Public | Exchange credentials for JWT |

### Users (Members 1 & 2)

| Method | Endpoint | Auth | Description |
|--------|---------|------|-------------|
| GET | `/api/v1/users/me` | 🔒 JWT | Return logged-in user's profile |
| PATCH | `/api/v1/users/updateMe` | 🔒 JWT | Update username, bio, avatarKey |
| GET | `/api/v1/users/:id` | Public | View any user's public profile |
| POST | `/api/v1/users/:id/follow` | 🔒 JWT | Follow a user (self-follow blocked) |
| DELETE | `/api/v1/users/:id/follow` | 🔒 JWT | Unfollow a user |
| GET | `/api/v1/users/:id/followers` | Public | List all followers |
| GET | `/api/v1/users/:id/following` | Public | List all accounts being followed |
| PATCH | `/api/v1/users/me/notifications` | 🔒 JWT | Update in-app/email alert preferences |

### Videos & Reviews (Member 3)

| Method | Endpoint | Auth | Description |
|--------|---------|------|-------------|
| GET | `/api/v1/videos` | Public | Paginated feed of all public videos |
| POST | `/api/v1/videos` | 🔒 JWT | Create video metadata (duration ≤ 300s) |
| PATCH | `/api/v1/videos/:id` | 🔒 Owner only | Update title or description |
| DELETE | `/api/v1/videos/:id` | 🔒 Owner or Admin | Permanently delete video |
| POST | `/api/v1/videos/:id/reviews` | 🔒 JWT | Submit 1–5 star review (one per user per video) |
| GET | `/api/v1/videos/:id/reviews` | Public | Get all reviews and average rating for a video |

### Admin (Member 3)

| Method | Endpoint | Auth | Description |
|--------|---------|------|-------------|
| GET | `/api/v1/admin/stats` | 🔒 Admin | Total users, videos, top uploaders (aggregation) |
| GET | `/api/v1/admin/moderation` | 🔒 Admin | Flagged and low-rated content queue |
| GET | `/api/v1/admin/health` | 🔒 Admin | Server uptime, memory, DB status |
| PATCH | `/api/v1/admin/users/:id/status` | 🔒 Admin | Soft-delete / reactivate user account |

### System

| Method | Endpoint | Auth | Description |
|--------|---------|------|-------------|
| GET | `/health` | Public | Basic heartbeat check |
| GET | `/api-docs` | Public | Interactive Swagger UI documentation |

---

## Security Features

### Authentication Flow
1. User registers → password hashed with Bcrypt (salt=10) → stored as `$2b$10$...`
2. User logs in → Bcrypt compares plaintext vs hash → JWT issued (24h expiry)
3. Protected routes → `auth.middleware.js` extracts Bearer token → verifies signature → attaches `req.user`
4. If token missing, expired, or tampered → `401 Unauthorized`

### Authorization (RBAC)
- Two roles: `user` (default) and `admin`
- `restrictTo("admin")` middleware blocks non-admins with `403 Forbidden`
- Ownership middleware: `resource.owner.toString() === req.user.id` — mismatches return `403`
- Admins can bypass ownership for delete operations (platform moderation)
- Admins cannot edit other users' content (privacy maintained)

### Data Integrity
- NoSQL injection prevention via `express-mongo-sanitize` (strips `$` and `.` from req.body/params/query)
- All incoming requests validated with Zod before reaching the database
- Compound unique indexes enforced at the MongoDB level — not just application code
- `active: false` soft-delete pattern preserves data relationships when banning users

### Error Handling
- Global async error middleware catches all unhandled errors
- Consistent JSON error format: `{ status: "error", message: "..." }`
- Stack traces suppressed in production (`NODE_ENV=production`)
- Custom `ApiError` class with HTTP status codes

---

## Setup & Installation

### Prerequisites

- Node.js v18 or higher
- MongoDB (local) or MongoDB Atlas account (free tier)
- Git

### Clone and Install

```bash
git clone https://github.com/Maya321-wq/ClipSphere.git
cd ClipSphere
git checkout develop
cd backend
npm install
```

### Environment Variables

Create a `.env` file inside the `backend/` folder:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/clipsphere
JWT_SECRET=your_super_secret_key_here_minimum_32_characters
NODE_ENV=development
```

> **MongoDB Atlas alternative** — replace MONGODB_URI with your Atlas connection string:
> `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/clipsphere`

> **Important:** `.env` is listed in `.gitignore` and must never be committed to GitHub.

---

## Running the Project

```bash
# Development mode (auto-restart on changes)
cd backend
npm run dev

# Expected output:
# [nodemon] starting...
# Server running on port 5000
# MongoDB connected: 127.0.0.1
```

### Verify the server is running

```bash
curl http://localhost:5000/health
# Expected: { "status": "ok", "message": "Server is running" }
```

---

## Testing with Postman

### Step 1 — Register a user

```
POST http://localhost:5000/api/v1/auth/register
Content-Type: application/json

{
  "username": "testuser",
  "email": "test@example.com",
  "password": "password123"
}
```

### Step 2 — Login and copy the token

```
POST http://localhost:5000/api/v1/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "password123"
}
```

Copy the `token` value from the response.

### Step 3 — Create a video (authenticated)

```
POST http://localhost:5000/api/v1/videos
Authorization: Bearer <your_token_here>
Content-Type: application/json

{
  "title": "My First Video",
  "description": "A test video",
  "duration": 120
}
```

### Step 4 — Submit a review

```
POST http://localhost:5000/api/v1/videos/<video_id>/reviews
Authorization: Bearer <your_token_here>
Content-Type: application/json

{
  "rating": 4,
  "comment": "Great video!"
}
```

### Step 5 — Test admin endpoints

First promote a user to admin in MongoDB:
```javascript
// In MongoDB Compass or mongo shell:
db.users.updateOne({ email: "test@example.com" }, { $set: { role: "admin" } })
```

Then login again to get a new token with the admin role, and test:
```
GET http://localhost:5000/api/v1/admin/stats
Authorization: Bearer <admin_token>

GET http://localhost:5000/api/v1/admin/health
Authorization: Bearer <admin_token>
```

### Swagger UI

Visit `http://localhost:5000/api-docs` in your browser for the full interactive API documentation with "Try it out" functionality.

---

## Environment Variables

| Variable | Required | Example | Description |
|---|---|---|---|
| `PORT` | Yes | `5000` | HTTP server port |
| `MONGODB_URI` | Yes | `mongodb://127.0.0.1:27017/clipsphere` | MongoDB connection string |
| `JWT_SECRET` | Yes | `some_long_random_string` | Secret key for signing JWT tokens (min 32 chars) |
| `NODE_ENV` | Yes | `development` | Environment: development or production |

---

## Phase Roadmap

| Phase | Deliverable | Grade | Status |
|---|---|---|---|
| Phase 1 | Backend Foundations & Security | 6% | ✅ Complete |
| Phase 2 | Next.js Frontend + MinIO Media Pipeline | 4.5% | Upcoming |
| Phase 3 | Real-Time (Socket.io) + Stripe Payments | 4.5% | Upcoming |
| Phase 4 | Docker, Nginx, Redis, Full DevOps | 5% | Upcoming |

---

*Submitted for SWAPD352 Web Development — Spring 2026*  
*Zewail City of Science, Technology and Innovation*
