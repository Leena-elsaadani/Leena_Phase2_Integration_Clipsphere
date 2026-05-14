import Comment from '../models/comment.model.js';
import Video from '../models/video.model.js';
import ApiError from '../utils/ApiError.js';
import { addEmailJob } from '../queues/emailQueue.js';
import { getIO } from '../socket/index.js';
import { invalidateTrendingCache } from './Videoservice.js';

export const addComment = async (videoId, userId, text) => {
  const video = await Video.findById(videoId).populate('owner', 'username email');
  if (!video) throw new ApiError(404, 'Video not found');

  const comment = await Comment.create({ text, user: userId, video: videoId });
  await comment.populate('user', 'username avatarUrl');

  // Trending score increment
  await Video.findByIdAndUpdate(videoId, { $inc: { trendingScore: 5 } });
  
  // Invalidate trending feed cache on engagement change
  await invalidateTrendingCache();

  /* ================= SOCKET NOTIFICATION ================= */
  try {
    const ownerId =
      video.owner?._id?.toString() || video.owner?.toString();

    const actorUsername = comment.user?.username;

    if (ownerId && ownerId !== userId.toString()) {
      const io = getIO();
      if (io) {
        io.to(ownerId).emit('notification:comment', {
          type: 'comment',
          actorUsername: actorUsername || 'Someone',
          videoId: video._id.toString(),
          videoTitle: video.title,
          preview: text.slice(0, 80),
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    console.error('[Socket] Failed to emit comment notification:', err.message);
  }

  /* ================= EMAIL (best-effort) ================= */
  if (video.owner && video.owner._id.toString() !== userId.toString()) {
    try {
      const commenterUsername = comment.user?.username;

      if (commenterUsername && video.owner.email) {
        addEmailJob({
          to: video.owner.email,
          recipientUsername: video.owner.username,
          actorUsername: commenterUsername,
          action: 'commented on',
          videoTitle: video.title,
          notificationPreferenceKey: 'newComment',
        }).catch((emailErr) => {
          console.error('[Email Queue] Failed to enqueue comment email job:', emailErr.message);
        });
      }
    } catch (emailErr) {
      console.error('Failed to prepare comment email:', emailErr.message);
    }
  }

  return comment;
};

export const getComments = async (videoId) => {
  const comments = await Comment.find({ video: videoId })
    .populate('user', 'username avatarUrl')
    .sort({ createdAt: -1 });
  return comments;
};

export const deleteComment = async (commentId, userId) => {
  const comment = await Comment.findById(commentId);
  if (!comment) throw new ApiError(404, 'Comment not found');
  if (comment.user.toString() !== userId.toString()) {
    throw new ApiError(403, 'You can only delete your own comments');
  }
  await comment.deleteOne();

  // Keep trendingScore consistent when comments are removed
  await Video.findByIdAndUpdate(comment.video, { $inc: { trendingScore: -5 } });
  
  // Invalidate trending feed cache on engagement change
  await invalidateTrendingCache();
  
  return { message: 'Comment deleted successfully' };
};