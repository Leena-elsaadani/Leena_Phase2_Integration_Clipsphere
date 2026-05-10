import Review from '../models/review.model.js';
import Video from '../models/video.model.js';
import User from '../models/user.model.js';
import ApiError from '../utils/ApiError.js';
import { addEmailJob } from '../queues/emailQueue.js';
import { getIO } from '../socket/index.js';
import { invalidateTrendingCache } from './Videoservice.js';

export const createReview = async (videoId, userId, reviewData) => {
  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(404, 'Video not found');

  try {
    const review = await Review.create({
      rating: reviewData.rating,
      comment: reviewData.comment,
      user: userId,
      video: videoId,
    });

    // Trending score increment
    await Video.findByIdAndUpdate(videoId, { $inc: { trendingScore: 5 } });
    
    // Invalidate trending feed cache on engagement change
    await invalidateTrendingCache();

    await review.populate('user', 'username avatarUrl');

    /* ================= SOCKET NOTIFICATION ================= */
    try {
      const ownerId = video.owner?.toString();

      const actorUsername = review.user?.username;

      if (ownerId && ownerId !== userId.toString()) {
        const io = getIO();
        if (!io) return;
        io.to(ownerId).emit('notification:review', {
          type: 'review',
          actorUsername: actorUsername || 'Someone',
          videoId: video._id.toString(),
          videoTitle: video.title,
          preview: (reviewData.comment || '').slice(0, 80),
          timestamp: new Date().toISOString(),
        });
      }
    } catch (socketErr) {
      console.error('[Socket] Failed to emit review notification:', socketErr.message);
    }

    /* ================= EMAIL (best-effort) ================= */
    if (video.owner && video.owner.toString() !== userId.toString()) {
      try {
        const owner = await User.findById(video.owner).select('username email');
        const reviewer = await User.findById(userId).select('username');

        if (owner && reviewer) {
          addEmailJob({
            to: owner.email,
            recipientUsername: owner.username,
            actorUsername: reviewer.username,
            action: 'reviewed',
            videoTitle: video.title,
            notificationPreferenceKey: 'newReview',
          }).catch((emailErr) => {
            console.error('[Email Queue] Failed to enqueue review email job:', emailErr.message);
          });
        }
      } catch (emailErr) {
        console.error('Failed to prepare review email:', emailErr.message);
      }
    }

    return review;
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(400, 'You have already reviewed this video');
    }
    throw error;
  }
};

export const getReviews = async (videoId) => {
  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(404, 'Video not found');

  const reviews = await Review.find({ video: videoId })
    .populate('user', 'username avatarUrl')
    .sort({ createdAt: -1 });

  return reviews;
};

export const deleteReview = async (reviewId, userId, userRole) => {
  const review = await Review.findById(reviewId);
  if (!review) throw new ApiError(404, 'Review not found');

  if (review.user.toString() !== userId.toString() && userRole !== 'admin') {
    throw new ApiError(403, 'You do not have permission to delete this review');
  }

  const videoId = review.video;
  await review.deleteOne();

  // Keep trendingScore consistent with weighted engagement (+5 per review).
  await Video.findByIdAndUpdate(videoId, { $inc: { trendingScore: -5 } });
  
  // Invalidate trending feed cache on engagement change
  await invalidateTrendingCache();

  return { message: 'Review deleted successfully' };
};