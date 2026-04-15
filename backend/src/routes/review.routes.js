import express from 'express';
import { create, getAll, remove } from '../controllers/review.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createReviewSchema } from '../validators/video.validator.js';

const router = express.Router({ mergeParams: true });

// GET  /api/v1/videos/:videoId/reviews
router.get('/:videoId/reviews', getAll);

// POST /api/v1/videos/:videoId/reviews  (auth)
router.post('/:videoId/reviews', protect, validate(createReviewSchema), create);

// DELETE /api/v1/videos/:videoId/reviews/:reviewId (auth)
router.delete('/:videoId/reviews/:reviewId', protect, remove);

export default router;