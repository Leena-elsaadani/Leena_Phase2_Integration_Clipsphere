import Like from '../models/like.model.js';
import Video from '../models/video.model.js';
import User from '../models/user.model.js';
import ApiError from '../utils/ApiError.js';
import { addEmailJob } from '../queues/emailQueue.js';
import { getIO } from '../socket/index.js';
import { invalidateTrendingCache } from './Videoservice.js';

export const likeVideo = async (videoId, userId) => {
  const video = await Video.findById(videoId).populate('owner');
  if (!video) throw new ApiError(404, 'Video not found');

  try {
    await Like.create({ user: userId, video: videoId });
    await Video.findByIdAndUpdate(videoId, { $inc: { trendingScore: 10 } });
    
    // Invalidate trending feed cache on engagement change
    await invalidateTrendingCache();
    
    try {
  const ownerId = video.owner?._id?.toString() || video.owner?.toString();
  if (ownerId && ownerId !== userId.toString()) {
    const liker = await User.findById(userId).select('username');

    const io = getIO();
    if (!io) return;
    io.to(ownerId).emit('notification:like', {
      type: 'like',
      actorUsername: liker?.username || 'Someone',
      videoId: video._id.toString(),
      videoTitle: video.title,
      timestamp: new Date().toISOString(),
    });
  }
} catch (socketErr) {
  console.error('[Socket] Failed to emit like notification:', socketErr.message);
}

    // Engagement email — only if owner is different from liker.
    // Email sending is best-effort and must never crash the like endpoint.
    if (video.owner && video.owner._id.toString() !== userId.toString()) {
      const owner = video.owner;
      try {
        const liker = await User.findById(userId).select('username');
        if (liker) {
          addEmailJob({
            to: owner.email,
            recipientUsername: owner.username,
            actorUsername: liker.username,
            action: 'liked',
            videoTitle: video.title,
            notificationPreferenceKey: 'newLike',
          }).catch((emailErr) => {
            console.error('[Email Queue] Failed to enqueue like email job:', emailErr.message);
          });
        }
      } catch (emailErr) {
        console.error('Failed to prepare like email:', emailErr.message);
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
  
  // Invalidate trending feed cache on engagement change
  await invalidateTrendingCache();
  
  return { message: 'Video unliked successfully' };
};

export const getLikesCount = async (videoId) => {
  const count = await Like.countDocuments({ video: videoId });
  return { videoId, likesCount: count };
};

export const getLikeStatus = async (videoId, userId) => {
  const exists = await Like.exists({ video: videoId, user: userId });
  return { videoId, liked: Boolean(exists) };
};