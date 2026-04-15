import {
  createReview,
  getReviews,
  deleteReview,
} from '../services/review.service.js';

export const create = async (req, res, next) => {
  try {
    const review = await createReview(req.params.videoId, req.user.id, req.body);
    res.status(201).json({ status: 'success', data: { review } });
  } catch (error) {
    next(error);
  }
};

export const getAll = async (req, res, next) => {
  try {
    const result = await getReviews(req.params.videoId);
    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
};

export const remove = async (req, res, next) => {
  try {
    const result = await deleteReview(
      req.params.reviewId,
      req.user.id,
      req.user.role
    );
    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
};