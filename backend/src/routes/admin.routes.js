import express from 'express';
import { getPlatformStats, updateUserStatus, getModerationQueue, getHealthStatus } from '../controllers/admin.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { restrictTo } from '../middleware/role.middleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/admin/stats:
 *   get:
 *     summary: Get platform statistics (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Platform stats
 *       403:
 *         description: Forbidden - admin access required
 */

/**
 * @swagger
 * /api/v1/admin/moderation:
 *   get:
 *     summary: Get moderation queue for flagged content
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Flagged videos list
 */

/**
 * @swagger
 * /api/v1/admin/health:
 *   get:
 *     summary: Get system health status (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System health information
 */

/**
 * @swagger
 * /api/v1/admin/users/{id}/status:
 *   patch:
 *     summary: Update user status (ban/suspend/activate)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: User status updated
 */

// all admin routes must be logged in and must be admin role
router.use(protect);
router.use(restrictTo(['admin']));

router.get('/stats', getPlatformStats);
router.get('/moderation', getModerationQueue);
router.get('/health', getHealthStatus);
router.patch('/users/:id/status', updateUserStatus);

export default router;