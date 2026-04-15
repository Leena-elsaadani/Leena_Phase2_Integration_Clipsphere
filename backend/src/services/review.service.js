import Review from '../models/review.model.js';
import Video from '../models/video.model.js';
import Like from '../models/like.model.js';
import User from '../models/user.model.js';
import ApiError from '../utils/ApiError.js';
import { sendEngagementEmail } from './email.service.js';

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

    const allReviews = await Review.find({ video: videoId });
    const avgRating =
      allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
    const ageInHours =
      (Date.now() - new Date(video.createdAt).getTime()) / (1000 * 60 * 60);
    const freshnessBonus = ageInHours < 24 ? 50 : 0;
    const likesCount = await Like.countDocuments({ video: videoId });
    const trendingScore = likesCount * 10 + avgRating * 2 + freshnessBonus;
    await Video.findByIdAndUpdate(videoId, { trendingScore });

    await review.populate('user', 'username avatarUrl');

    // Engagement email with preference check
    if (video.owner && video.owner.toString() !== userId.toString()) {
      const owner = await User.findById(video.owner).select('username email notificationPreferences');
      if (owner && owner.notificationPreferences?.newComment !== false) {
        const reviewer = await User.findById(userId).select('username');
        if (reviewer) {
          sendEngagementEmail(owner.email, owner.username, reviewer.username, 'reviewed', video.title);
        }
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

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  return { reviews, avgRating: Math.round(avgRating * 10) / 10, total: reviews.length };
};

export const deleteReview = async (reviewId, userId, userRole) => {
  const review = await Review.findById(reviewId);
  if (!review) throw new ApiError(404, 'Review not found');

  if (review.user.toString() !== userId.toString() && userRole !== 'admin') {
    throw new ApiError(403, 'You do not have permission to delete this review');
  }

  const videoId = review.video;
  await review.deleteOne();

  const video = await Video.findById(videoId);
  if (video) {
    const allReviews = await Review.find({ video: videoId });
    const avgRating =
      allReviews.length > 0
        ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
        : 0;
    const ageInHours =
      (Date.now() - new Date(video.createdAt).getTime()) / (1000 * 60 * 60);
    const freshnessBonus = ageInHours < 24 ? 50 : 0;
    const likesCount = await Like.countDocuments({ video: videoId });
    const trendingScore = likesCount * 10 + avgRating * 2 + freshnessBonus;
    await Video.findByIdAndUpdate(videoId, { trendingScore });
  }

  return { message: 'Review deleted successfully' };
};