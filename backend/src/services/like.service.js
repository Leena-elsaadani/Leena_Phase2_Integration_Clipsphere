import Like from '../models/like.model.js';
import Video from '../models/video.model.js';
import ApiError from '../utils/ApiError.js';

export const likeVideo = async (videoId, userId) => {
  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(404, 'Video not found');

  try {
    await Like.create({ user: userId, video: videoId });

    // +10 to trendingScore on like
    await Video.findByIdAndUpdate(videoId, { $inc: { trendingScore: 10 } });

    return { message: 'Video liked successfully' };
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(400, 'You have already liked this video');
    }
    throw error;
  }
};

export const unlikeVideo = async (videoId, userId) => {
  const like = await Like.findOneAndDelete({ user: userId, video: videoId });
  if (!like) throw new ApiError(404, 'You have not liked this video');

  // -10 from trendingScore on unlike
  await Video.findByIdAndUpdate(videoId, { $inc: { trendingScore: -10 } });

  return { message: 'Video unliked successfully' };
};

export const getLikesCount = async (videoId) => {
  const count = await Like.countDocuments({ video: videoId });
  return { videoId, likesCount: count };
};