import express from 'express';
import { getPlatformStats, updateUserStatus, getModerationQueue, getHealthStatus } from '../controllers/admin.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { restrictTo } from '../middleware/role.middleware.js';

const router = express.Router();

// all admin routes must be logged in and must be admin role
router.use(protect);
router.use(restrictTo(['admin']));

router.get('/stats', getPlatformStats);
router.get('/moderation', getModerationQueue);
router.get('/health', getHealthStatus);
router.patch('/users/:id/status', updateUserStatus);

export default router;