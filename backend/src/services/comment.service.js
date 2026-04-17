import Comment from '../models/comment.model.js';
import Video from '../models/video.model.js';
import ApiError from '../utils/ApiError.js';
import { sendEngagementEmail } from './email.service.js';

export const addComment = async (videoId, userId, text) => {
  const video = await Video.findById(videoId).populate('owner', 'username email');
  if (!video) throw new ApiError(404, 'Video not found');

  const comment = await Comment.create({ text, user: userId, video: videoId });
  await comment.populate('user', 'username avatarUrl');

  // Trending score increment (per engagement weight)
  await Video.findByIdAndUpdate(videoId, { $inc: { trendingScore: 5 } });

  // Engagement email — best-effort; do not crash the API on email failures
  if (video.owner && video.owner._id.toString() !== userId.toString()) {
    try {
      const commenterUsername = comment.user?.username;
      if (commenterUsername && video.owner.email) {
        sendEngagementEmail(
          video.owner.email,
          video.owner.username,
          commenterUsername,
          'commented on',
          video.title,
          'newComment'
        ).catch((emailErr) => {
          console.error('Failed to send comment email:', emailErr.message);
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
  return { message: 'Comment deleted successfully' };
};