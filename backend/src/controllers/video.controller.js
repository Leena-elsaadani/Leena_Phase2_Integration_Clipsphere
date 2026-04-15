import { uploadVideo, getPublicFeed, getFollowingFeed, getTrendingFeed, generateVideoURL } from '../services/Videoservice.js';
import { createReview as createReviewService } from '../services/review.service.js';

// Upload video with metadata
export const uploadVideo_controller = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No video file provided." });
    }

    const { title, description, tags, visibility } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Title is required." });
    }

    const video = await uploadVideo({
      uploaderId: req.user.id,
      title: title.trim(),
      description: description?.trim() || "",
      tags: tags ? tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      visibility: visibility || "public",
      buffer: req.file.buffer,
      videoMeta: req.videoMetadata,
    });

    res.status(201).json({
      success: true,
      message: "Video uploaded successfully",
      data: video,
    });
  } catch (err) {
    next(err);
  }
};

// Get all public videos
export const getAllVideos = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const skip = parseInt(req.query.skip) || 0;
    
    const result = await getPublicFeed(limit, skip);
    res.status(200).json({
      status: 'success',
      results: result.videos.length,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

// Get following feed
export const getFollowingFeed_controller = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const skip = parseInt(req.query.skip) || 0;
    
    // TODO: get user's followingIds from User model
    const followingIds = req.user.following || [];
    
    const result = await getFollowingFeed(followingIds, limit, skip);
    res.status(200).json({
      status: 'success',
      results: result.videos.length,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

// Get trending feed
export const getTrendingFeed_controller = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const skip = parseInt(req.query.skip) || 0;
    
    const result = await getTrendingFeed(limit, skip);
    res.status(200).json({
      status: 'success',
      results: result.videos.length,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

// Update a video
export const updateVideo = async (req, res) => {
  res.status(501).json({
    status: 'error',
    message: 'Update video not implemented',
  });
};

// Delete a video
export const deleteVideo = async (req, res) => {
  res.status(501).json({
    status: 'error',
    message: 'Delete video not implemented',
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
