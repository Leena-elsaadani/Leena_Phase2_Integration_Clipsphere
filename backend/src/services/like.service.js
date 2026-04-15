import Like from '../models/like.model.js';
import Video from '../models/video.model.js';
import User from '../models/user.model.js';
import ApiError from '../utils/ApiError.js';
import { sendEngagementEmail } from './email.service.js';

export const likeVideo = async (videoId, userId) => {
  const video = await Video.findById(videoId).populate('owner');
  if (!video) throw new ApiError(404, 'Video not found');

  try {
    await Like.create({ user: userId, video: videoId });
    await Video.findByIdAndUpdate(videoId, { $inc: { trendingScore: 10 } });

    // Engagement email — only if owner is different from liker and prefs allow
    if (video.owner && video.owner._id.toString() !== userId.toString()) {
      const owner = video.owner;
      if (owner.notificationPreferences?.newLike !== false) {
        const liker = await User.findById(userId).select('username');
        if (liker) {
          sendEngagementEmail(
            owner.email,
            owner.username,
            liker.username,
            'liked',
            video.title
          );
        }
      }
    }

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
  await Video.findByIdAndUpdate(videoId, { $inc: { trendingScore: -10 } });
  return { message: 'Video unliked successfully' };
};

export const getLikesCount = async (videoId) => {
  const count = await Like.countDocuments({ video: videoId });
  return { videoId, likesCount: count };
};