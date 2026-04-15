/**
 * services/videoService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Business logic for videos:
 *   - uploadVideo()      → upload to MinIO, then save MongoDB doc atomically
 *   - getPublicFeed()    → paginated public feed (newest)
 *   - getFollowingFeed() → paginated feed filtered by followed users
 *   - getTrendingFeed()  → paginated feed sorted by engagementScore
 *   - generateVideoURL() → presigned playback URL for a single video
 */

import { v4 as uuidv4 } from "uuid";
import Video from "../models/video.model.js";
import { uploadBuffer, deleteObject, generateDownloadURL } from "./s3Service.js";

const BUCKET = process.env.MINIO_BUCKET || "videos";

// ── Upload Pipeline ───────────────────────────────────────────────────────────

/**
 * Upload a video buffer to MinIO, then persist the Video document.
 * If the DB save fails, the MinIO object is deleted (atomic guarantee).
 *
 * @param {object} params
 * @param {string}  params.uploaderId   - User._id
 * @param {string}  params.title
 * @param {string}  params.description
 * @param {string[]} params.tags
 * @param {string}  params.visibility
 * @param {Buffer}  params.buffer       - In-memory file from Multer
 * @param {object}  params.videoMeta    - { duration, fileSizeBytes, mimeType }
 * @returns {Promise<Video>}
 */
async function uploadVideo({
  uploaderId,
  title,
  description,
  tags,
  visibility,
  buffer,
  videoMeta,
}) {
  // 1. Generate a unique object key
  const objectKey = `videos/${uuidv4()}.mp4`;

  // 2. Upload to MinIO first
  await uploadBuffer(objectKey, buffer, videoMeta.mimeType);

  // 3. Save metadata to MongoDB
  let video;
  try {
    video = await Video.create({
      uploader: uploaderId,
      title,
      description,
      tags: tags || [],
      visibility: visibility || "public",
      objectKey,
      duration: videoMeta.duration,
      fileSizeBytes: videoMeta.fileSizeBytes,
      mimeType: videoMeta.mimeType,
    });
  } catch (dbErr) {
    // Rollback: remove the already-uploaded MinIO object
    await deleteObject(objectKey).catch(() => {});
    throw dbErr; // re-throw for the controller
  }

  return video;
}

// ── Feed Queries ──────────────────────────────────────────────────────────────

/**
 * Public feed sorted by newest.
 * @param {number} limit
 * @param {number} skip
 */
async function getPublicFeed(limit = 10, skip = 0) {
  const [videos, total] = await Promise.all([
    Video.find({ visibility: "public" })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("uploader", "username avatar")
      .lean(),
    Video.countDocuments({ visibility: "public" }),
  ]);
  return { videos, total };
}

/**
 * Following feed — only videos from users the requester follows.
 * @param {string[]} followingIds - Array of User._id strings
 * @param {number}   limit
 * @param {number}   skip
 */
async function getFollowingFeed(followingIds = [], limit = 10, skip = 0) {
  const filter = {
    visibility: "public",
    uploader: { $in: followingIds },
  };
  const [videos, total] = await Promise.all([
    Video.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("uploader", "username avatar")
      .lean(),
    Video.countDocuments(filter),
  ]);
  return { videos, total };
}

/**
 * Trending feed sorted by engagementScore descending.
 * @param {number} limit
 * @param {number} skip
 */
async function getTrendingFeed(limit = 10, skip = 0) {
  const [videos, total] = await Promise.all([
    Video.find({ visibility: "public" })
      .sort({ engagementScore: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("uploader", "username avatar")
      .lean(),
    Video.countDocuments({ visibility: "public" }),
  ]);
  return { videos, total };
}

/**
 * Get a presigned download URL for a video's objectKey.
 * @param {string} objectKey
 */
async function generateVideoURL(objectKey) {
  return generateDownloadURL(objectKey);
}

export {
  uploadVideo,
  getPublicFeed,
  getFollowingFeed,
  getTrendingFeed,
  generateVideoURL,
};