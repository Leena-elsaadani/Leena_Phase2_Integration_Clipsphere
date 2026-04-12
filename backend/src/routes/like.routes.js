import express from 'express';
import { like, unlike, likesCount } from '../controllers/like.controller.js';
import { create, getAll, remove } from '../controllers/comment.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router({ mergeParams: true });

// Likes
router.post('/:videoId/likes', protect, like);
router.delete('/:videoId/likes', protect, unlike);
router.get('/:videoId/likes', likesCount);

// Comments
router.post('/:videoId/comments', protect, create);
router.get('/:videoId/comments', getAll);
router.delete('/:videoId/comments/:commentId', protect, remove);

export default router;