import Comment from '../models/comment.model.js';
import Video from '../models/video.model.js';
import ApiError from '../utils/ApiError.js';

export const addComment = async (videoId, userId, text) => {
  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(404, 'Video not found');

  const comment = await Comment.create({ text, user: userId, video: videoId });
  await comment.populate('user', 'username avatarUrl');
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
  return { message: 'Comment deleted successfully' };
};