import express from 'express';
import { createVideo, getAllVideos, updateVideo, deleteVideo, createReview } from '../controllers/video.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { restrictTo } from '../middleware/role.middleware.js';
import ownershipMiddleware from '../middleware/ownership.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  createVideoSchema,
  updateVideoSchema,
  createReviewSchema,
} from '../validators/video.validator.js';
import Video from '../models/video.model.js';

const router = express.Router();

// Public route anyone can see the video feed
router.get('/', getAllVideos);

// Protected routes must be logged in
router.post(
  '/',
  protect,                          // 1. Check JWT
  validate(createVideoSchema),      // 2. Validate the body with Zod
  createVideo                       // 3. Create the video
);

router.patch(
  '/:id',
  protect,                                           // 1. Logged in
  validate(updateVideoSchema),                       // 2. Valid body
  ownershipMiddleware(Video),                        // 3. Do you own this video
  updateVideo                                        // 4. Update it
);

router.delete(
  '/:id',
  protect,
  // owner OR admin can delete
  // We pass the model and tell it admins can bypass ownership
  ownershipMiddleware(Video, { allowAdmin: true }),
  deleteVideo
);

// Reviews are nested under videos: /videos/:id/reviews
router.post(
  '/:id/reviews',
  protect,
  validate(createReviewSchema),
  createReview
);

/**
 * @swagger
 * /api/v1/videos:
 *   get:
 *     summary: Get all public videos
 *     tags: [Videos]
 *     responses:
 *       200:
 *         description: List of videos
 *       500:
 *         description: Server error
 *   post:
 *     summary: Create a new video (requires auth)
 *     tags: [Videos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               duration:
 *                 type: number
 *     responses:
 *       201:
 *         description: Video created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */

export default router;