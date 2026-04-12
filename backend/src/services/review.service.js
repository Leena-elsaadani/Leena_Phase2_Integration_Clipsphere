import Review from '../models/review.model.js';
import Video from '../models/video.model.js';
import ApiError from '../utils/ApiError.js';

export const createReview = async (videoId, userId, reviewData) => {
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, 'Video not found');
  }

  try {
    const review = await Review.create({
      rating: reviewData.rating,
      comment: reviewData.comment,
      user: userId,
      video: videoId,
    });

    // Recalculate avgRating for this video
    const allReviews = await Review.find({ video: videoId });
    const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;

    // Freshness bonus — videos less than 24hrs old get +50
    const ageInHours = (Date.now() - new Date(video.createdAt).getTime()) / (1000 * 60 * 60);
    const freshnessBonus = ageInHours < 24 ? 50 : 0;

    // Get current likes count
    const likesCount = await (await import('../models/like.model.js')).default.countDocuments({ video: videoId });

    // Total_Score = (Likes x 10) + (Avg_Rating x 2) + Freshness_Bonus
    const trendingScore = (likesCount * 10) + (avgRating * 2) + freshnessBonus;

    await Video.findByIdAndUpdate(videoId, { trendingScore });

    return review;
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(400, 'You have already reviewed this video');
    }
    throw error;
  }
};