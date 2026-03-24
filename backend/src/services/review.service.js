import Review from '../models/review.model.js';
import Video from '../models/video.model.js';
import ApiError from '../utils/ApiError.js';

export const createReview = async (videoId, userId, reviewData) => {
  // 1. Check the video exists first
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, 'Video not found');
  }

  // 2. Try to create the review
  // If the user already reviewed this video, MongoDB will throw a duplicate key error (code 11000) because of our compound unique index
  try {
    const review = await Review.create({
      rating: reviewData.rating,
      comment: reviewData.comment,
      user: userId,
      video: videoId,
    });
    return review;
  } catch (error) {
    // Handle the MongoDB duplicate key error
    if (error.code === 11000) {
      throw new ApiError(400, 'You have already reviewed this video');
    }
    throw error;
  }
};