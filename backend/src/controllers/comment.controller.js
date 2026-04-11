import { addComment, getComments, deleteComment } from '../services/comment.service.js';

export const create = async (req, res, next) => {
  try {
    const comment = await addComment(req.params.videoId, req.user.id, req.body.text);
    res.status(201).json({ status: 'success', data: { comment } });
  } catch (error) {
    next(error);
  }
};

export const getAll = async (req, res, next) => {
  try {
    const comments = await getComments(req.params.videoId);
    res.json({ status: 'success', data: { comments } });
  } catch (error) {
    next(error);
  }
};

export const remove = async (req, res, next) => {
  try {
    const result = await deleteComment(req.params.commentId, req.user.id);
    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
};