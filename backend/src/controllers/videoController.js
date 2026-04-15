import * as videoService from "../services/video.service.js";
import { generateUploadURL } from "../services/s3Service.js";
import { v4 as uuidv4 } from "uuid";
import Video from "../models/video.model.js";

// ── Upload ─────────────────────────────────────
export const uploadVideo = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No video file provided." });
    }

    const { title, description, tags, visibility } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Title is required." });
    }

    const video = await videoService.uploadVideo({
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

// ── Presigned URL ──────────────────────────────
export const getPresignedUploadURL = async (req, res, next) => {
  try {
    const ext = (req.query.fileName || "upload.mp4").split(".").pop();
    const objectKey = `videos/${uuidv4()}.${ext}`;

    const url = await generateUploadURL(objectKey, "video/mp4");

    res.json({
      success: true,
      data: { url, objectKey },
    });
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