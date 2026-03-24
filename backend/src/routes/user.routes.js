import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import {
  getMe,
  updateMe,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  updateNotificationPreferences
} from "../controllers/user.controller.js";

const router = express.Router();

// All user routes require authentication
router.use(protect);

// Profile
router.get("/me", getMe);
router.patch("/updateMe", updateMe);

// Notification preferences
// NOTE: this must be defined before /:id routes to avoid "me" being treated as an id
router.patch("/me/notifications", updateNotificationPreferences);

// Social graph
router.post("/:id/follow", followUser);
router.delete("/:id/follow", unfollowUser);
router.get("/:id/followers", getFollowers);
router.get("/:id/following", getFollowing);

export default router;