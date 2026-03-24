import { createVideo as createVideoService, getAllVideos as getAllVideosService, updateVideo as updateVideoService, deleteVideo as deleteVideoService } from '../services/video.service.js';
import { createReview as createReviewService } from '../services/review.service.js';

// Create video metadata
export const createVideo = async (req, res) => {
  const video = await createVideoService(req.body, req.user.id);
  res.status(201).json({
    status: 'success',
    data: { video },
  });
};

// Get all public videos
export const getAllVideos = async (req, res) => {
  const result = await getAllVideosService(req.query);
  res.status(200).json({
    status: 'success',
    results: result.videos.length,
    data: result,
  });
};

// Update a video
export const updateVideo = async (req, res) => {
  const video = await updateVideoService(req.params.id, req.body);
  res.status(200).json({
    status: 'success',
    data: { video },
  });
};

// Delete a video
export const deleteVideo = async (req, res) => {
  await deleteVideoService(req.params.id);
  res.status(204).json({
    status: 'success',
    data: null,
  });
};

// Submit a review
export const createReview = async (req, res) => {
  const review = await createReviewService(
    req.params.id, // videoId from URL
    req.user.id,   // userId from JWT 
    req.body       // { rating, comment }
  );
  res.status(201).json({
    status: 'success',
    data: { review },
  });
};