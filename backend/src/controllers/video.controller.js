import { uploadVideo, getPublicFeed, getFollowingFeed, getTrendingFeed, generateVideoURL } from '../services/Videoservice.js';
import { createReview as createReviewService } from '../services/review.service.js';
import Video from '../models/video.model.js';
import Follower from '../models/follower.model.js';
import { deleteObject } from '../services/s3Service.js';

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

    const followingDocs = await Follower.find({ follower: req.user.id }).select('following').lean();
    const followingIds = followingDocs.map((f) => f.following);

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

// Presigned stream URL (public for public videos, auth required for private)
export const getStreamURL = async (req, res, next) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Check if video is private and user is not authenticated or not the owner
    if (video.status === 'private') {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ message: 'Authentication required for private videos' });
      }
      if (String(video.owner) !== String(req.user.id)) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    if (!video.videoKey) {
      return res.status(404).json({ message: 'Video file not available' });
    }
    const url = await generateVideoURL(video.videoKey);
    res.status(200).json({
      status: 'success',
      data: { url },
    });
  } catch (err) {
    next(err);
  }
};

// Update a video
export const updateVideo = async (req, res, next) => {
  try {
    const video = req.resource;
    if (!video) {
      return res.status(404).json({ status: 'error', message: 'Video not found' });
    }

    const { title, description } = req.body;
    const updates = {};

    if (typeof title === 'string') updates.title = title;
    if (typeof description === 'string') updates.description = description;

    const updatedVideo = await Video.findByIdAndUpdate(video._id, updates, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      status: 'success',
      message: 'Video updated successfully',
      data: updatedVideo,
    });
  } catch (err) {
    next(err);
  }
};

// Delete a video
export const deleteVideo = async (req, res, next) => {
  try {
    const video = req.resource;
    if (!video) {
      return res.status(404).json({ status: 'error', message: 'Video not found' });
    }

    const videoId = req.params.id;

    // Delete from MinIO (best-effort; DB deletion should still succeed)
    if (video.videoKey) {
      try {
        await deleteObject(video.videoKey);
      } catch (s3Err) {
        console.error('Failed to delete video object from storage:', s3Err.message);
      }
    }

    if (video.thumbnailKey) {
      try {
        await deleteObject(video.thumbnailKey);
      } catch (s3Err) {
        console.error('Failed to delete thumbnail from storage:', s3Err.message);
      }
    }

    await Video.findByIdAndDelete(videoId);

    res.status(200).json({
      status: 'success',
      message: 'Video deleted successfully',
    });
  } catch (err) {
    next(err);
  }
};

// Increment view count
export const incrementViewCount = async (req, res, next) => {
  try {
    const video = req.resource;
    if (!video) {
      return res.status(404).json({ status: 'error', message: 'Video not found' });
    }

    await Video.findByIdAndUpdate(video._id, { $inc: { viewsCount: 1 } });

    res.status(200).json({
      status: 'success',
      message: 'View count incremented',
    });
  } catch (err) {
    next(err);
  }
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
