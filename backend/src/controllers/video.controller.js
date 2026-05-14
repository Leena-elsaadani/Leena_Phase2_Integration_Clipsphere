import { uploadVideo, getPublicFeed, getFollowingFeed, getTrendingFeed, generateVideoURL, invalidateTrendingCache } from '../services/Videoservice.js';
import { createReview as createReviewService } from '../services/review.service.js';
import Video from '../models/video.model.js';
import Follower from '../models/follower.model.js';
import { deleteObject } from '../services/s3Service.js';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';

function normalizePositiveInt(value, fallback) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

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
    const owner = req.query.owner;

    if (owner) {
      const [videos, total] = await Promise.all([
        Video.find({ status: "public", owner })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate("owner", "username avatarUrl")
          .lean(),
        Video.countDocuments({ status: "public", owner }),
      ]);
      return res.status(200).json({
        status: 'success',
        results: videos.length,
        data: { videos, total },
      });
    }

    // Optional personalization: prioritize followed creators if auth cookie/header exists.
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
    let userId = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, env.JWT_SECRET);
        userId = decoded?.id || null;
      } catch {
        userId = null;
      }
    }

    let result;
    if (!userId) {
      result = await getPublicFeed(limit, skip);
    } else {
      const followingDocs = await Follower.find({ follower: userId }).select('following').lean();
      const followingIds = followingDocs.map((f) => f.following);

      if (!followingIds.length) {
        result = await getTrendingFeed(limit, skip);
      } else {
        const followingFilter = {
          status: 'public',
          owner: { $in: followingIds },
        };
        const restFilter = {
          status: 'public',
          owner: { $nin: followingIds },
        };

        const [followingTotal, restTotal] = await Promise.all([
          Video.countDocuments(followingFilter),
          Video.countDocuments(restFilter),
        ]);

        const videos = [];
        if (skip < followingTotal) {
          const followingSlice = await Video.find(followingFilter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('owner', 'username avatarUrl')
            .lean();
          videos.push(...followingSlice);

          const remaining = limit - followingSlice.length;
          if (remaining > 0) {
            const restSlice = await Video.find(restFilter)
              .sort({ trendingScore: -1, createdAt: -1 })
              .limit(remaining)
              .populate('owner', 'username avatarUrl')
              .lean();
            videos.push(...restSlice);
          }
        } else {
          const restSkip = skip - followingTotal;
          const restSlice = await Video.find(restFilter)
            .sort({ trendingScore: -1, createdAt: -1 })
            .skip(restSkip)
            .limit(limit)
            .populate('owner', 'username avatarUrl')
            .lean();
          videos.push(...restSlice);
        }

        result = {
          videos,
          total: followingTotal + restTotal,
        };
      }
    }

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

// Presigned stream URL (auth required — matches frontend videoApi.getStreamURL)
export const getStreamURL = async (req, res, next) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }
    if (video.status === 'private' && String(video.owner) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
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

// Public view counter endpoint (called when playback starts)
export const incrementViews = async (req, res, next) => {
  try {
    const updated = await Video.findByIdAndUpdate(
      req.params.id,
      { $inc: { viewsCount: 1 } },
      { new: true }
    ).select('viewsCount');

    if (!updated) {
      return res.status(404).json({ message: 'Video not found' });
    }

    res.status(200).json({
      status: 'success',
      data: { viewsCount: updated.viewsCount },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get a small "stack" around a video for smooth watch navigation.
 * Returns only a few items (prev/current/next), so the frontend can virtualize efficiently.
 *
 * Order: newest → older (createdAt desc, _id desc as tie-break).
 * The "next" video (scroll down) is the next older item.
 *
 * GET /api/v1/videos/:id/stack?before=2&after=2
 */
export const getVideoStack = async (req, res, next) => {
  try {
    const before = normalizePositiveInt(req.query.before, 2); // newer items
    const after = normalizePositiveInt(req.query.after, 2);   // older items

    const video = await Video.findById(req.params.id).lean();
    if (!video) {
      return res.status(404).json({ status: 'error', message: 'Video not found' });
    }

    // Only public videos are navigable by default.
    // (Private playback already requires auth in /stream-url; keep stack public-only for now.)
    if (video.status !== 'public') {
      return res.status(403).json({ status: 'error', message: 'Access denied' });
    }

    const createdAt = video.createdAt;
    const _id = video._id;

    // Newer than current (towards start of feed)
    const newer = await Video.find({
      status: 'public',
      $or: [
        { createdAt: { $gt: createdAt } },
        { createdAt, _id: { $gt: _id } },
      ],
    })
      .sort({ createdAt: 1, _id: 1 }) // smallest → largest (so we can keep stable ordering)
      .limit(before)
      .populate('owner', 'username avatarUrl')
      .lean();

    // Older than current (towards end of feed)
    const older = await Video.find({
      status: 'public',
      $or: [
        { createdAt: { $lt: createdAt } },
        { createdAt, _id: { $lt: _id } },
      ],
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(after)
      .populate('owner', 'username avatarUrl')
      .lean();

    // Convert newer to feed order (newest → older)
    const newerInFeedOrder = [...newer].sort((a, b) => {
      const ca = new Date(a.createdAt).getTime();
      const cb = new Date(b.createdAt).getTime();
      if (ca !== cb) return cb - ca;
      return String(b._id).localeCompare(String(a._id));
    });

    const stack = [
      ...newerInFeedOrder,
      await Video.findById(_id).populate('owner', 'username avatarUrl').lean(),
      ...older,
    ].filter(Boolean);

    res.status(200).json({
      status: 'success',
      data: {
        videos: stack,
        index: newerInFeedOrder.length,
      },
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

    const { title, description, visibility } = req.body;
    const updates = {};

    if (typeof title === 'string') updates.title = title;
    if (typeof description === 'string') updates.description = description;
    if (typeof visibility === 'string' && ['public', 'private', 'flagged'].includes(visibility)) {
      updates.status = visibility;
    }

    const updatedVideo = await Video.findByIdAndUpdate(video._id, updates, {
      new: true,
      runValidators: true,
    });

    // Invalidate trending feed cache since video visibility or metadata changed
    await invalidateTrendingCache();

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

    // Delete from MinIO (best-effort; DB deletion should still succeed to avoid broken states)
    const storagePromises = [];
    if (video.videoKey) storagePromises.push(deleteObject(video.videoKey));
    if (video.thumbnailKey) storagePromises.push(deleteObject(video.thumbnailKey));
    
    await Promise.allSettled(storagePromises).then(results => {
      results.forEach(result => {
        if (result.status === 'rejected') {
          console.error('Failed to delete object from storage:', result.reason?.message);
        }
      });
    });

    // Avoid partial deletion state: cascade delete DB dependencies (best-effort)
    const Like = (await import('../models/like.model.js')).default;
    const Comment = (await import('../models/comment.model.js')).default;
    const Review = (await import('../models/review.model.js')).default;

    await Promise.allSettled([
      Like.deleteMany({ video: videoId }),
      Comment.deleteMany({ video: videoId }),
      Review.deleteMany({ video: videoId })
    ]);

    // Finally delete the video record itself
    await Video.findByIdAndDelete(videoId);

    // Invalidate trending cache after removing a video
    await invalidateTrendingCache();

    res.status(200).json({
      status: 'success',
      message: 'Video deleted successfully',
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
