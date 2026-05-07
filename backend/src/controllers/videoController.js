/**
 * DEPRECATED: This file is no longer used.
 * 
 * Use controllers/video.controller.js instead, which provides:
 * - ES6 modules (instead of CommonJS)
 * - Updated video service integration
 * - Current video controller methods
 * 
 * Do not import or use this file.
 */

throw new Error('videoController.js is deprecated. Use controllers/video.controller.js instead');

  } catch (err) {
    next(err);
  }
};

// ── Feed ───────────────────────────────────────
export const getFeed = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const skip = parseInt(req.query.skip) || 0;

    const { videos, total } = await videoService.getPublicFeed(limit, skip);

    res.json({
      success: true,
      data: { videos, total, limit, skip },
    });
  } catch (err) {
    next(err);
  }
};

// ── Following Feed ─────────────────────────────
export const getFollowingFeed = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const skip = parseInt(req.query.skip) || 0;

    const followingIds = req.user.following || [];

    const { videos, total } = await videoService.getFollowingFeed(
      followingIds,
      limit,
      skip
    );

    res.json({
      success: true,
      data: { videos, total, limit, skip },
    });
  } catch (err) {
    next(err);
  }
};

// ── Trending Feed ──────────────────────────────
export const getTrendingFeed = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const skip = parseInt(req.query.skip) || 0;

    const { videos, total } = await videoService.getTrendingFeed(limit, skip);

    res.json({
      success: true,
      data: { videos, total, limit, skip },
    });
  } catch (err) {
    next(err);
  }
};

// ── Stream URL ─────────────────────────────────
export const getStreamURL = async (req, res, next) => {
  try {
    const video = await Video.findById(req.params.id);

    if (!video) {
      return res.status(404).json({ success: false, message: "Video not found" });
    }

    if (
      video.visibility === "private" &&
      String(video.uploader) !== String(req.user?.id)
    ) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const url = await videoService.generateVideoURL(video.objectKey);

    res.json({
      success: true,
      data: { url },
    });
  } catch (err) {
    next(err);
  }
};