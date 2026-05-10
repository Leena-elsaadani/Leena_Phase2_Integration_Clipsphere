import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import {
  getMe,
  getUserById,
  updateMe,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  updateNotificationPreferences
} from "../controllers/user.controller.js";

const router = express.Router();

/**
 * @swagger
 * /api/v1/users/me:
 *   get:
 *     summary: Get current authenticated user's profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved
 *       401:
 *         description: Unauthorized
 * 
 * /api/v1/users/{id}:
 *   get:
 *     summary: Get user public profile
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: User profile
 */

/**
 * @swagger
 * /api/v1/users/{id}/followers:
 *   get:
 *     summary: Get list of followers for a user (public)
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Followers list
 */

/**
 * @swagger
 * /api/v1/users/{id}/following:
 *   get:
 *     summary: Get list of users that a user follows (public)
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Following list
 */

// Public routes - no auth required
router.get("/:id([0-9a-fA-F]{24})", getUserById);
router.get("/:id/followers", getFollowers);
router.get("/:id/following", getFollowing);

// All routes below require authentication
router.use(protect);

// Profile
router.get("/me", getMe);
router.patch("/updateMe", updateMe);

// Notification preferences
router.patch("/me/notifications", updateNotificationPreferences);
router.patch("/preferences", updateNotificationPreferences);

// Social graph
router.post("/:id/follow", followUser);
router.delete("/:id/follow", unfollowUser);

export default router;