import { likeVideo, unlikeVideo, getLikesCount, getLikeStatus } from '../services/like.service.js';

export const like = async (req, res, next) => {
  try {
    const result = await likeVideo(req.params.videoId, req.user.id);
    res.status(201).json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
};

export const unlike = async (req, res, next) => {
  try {
    const result = await unlikeVideo(req.params.videoId, req.user.id);
    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
};

export const likesCount = async (req, res, next) => {
  try {
    const result = await getLikesCount(req.params.videoId);
    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
};

export const likeStatus = async (req, res, next) => {
  try {
    const result = await getLikeStatus(req.params.videoId, req.user.id);
    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
};