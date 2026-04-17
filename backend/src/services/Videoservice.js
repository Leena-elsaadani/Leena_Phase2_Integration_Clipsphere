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
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import fs from "fs/promises";
import os from "os";
import path from "path";

const BUCKET = process.env.MINIO_BUCKET || "videos";

// Make sure ffmpeg binary is discoverable for fluent-ffmpeg.
// Prefer system ffmpeg, fall back to ffmpeg-static
try {
  ffmpeg.setFfmpegPath('ffmpeg'); // Try system ffmpeg first
} catch {
  if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath); // Fall back to static binary
  }
}

async function extractThumbnail(buffer, seconds = 2) {

async function extractThumbnail(buffer, seconds) {
  if (!buffer) return null;

  const inputPath = path.join(os.tmpdir(), `clip-${uuidv4()}.mp4`);
  const outputFilename = `thumb-${uuidv4()}.jpg`;
  const outputPath = path.join(os.tmpdir(), outputFilename);
  const outputBase = path.basename(outputFilename, path.extname(outputFilename));
  let resolvedOutputPath = null;

  try {
    // fluent-ffmpeg's screenshots() writes to disk; we use OS temp storage.
    await fs.writeFile(inputPath, buffer);

    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .on("end", resolve)
        .on("error", reject)
        .screenshots({
          timestamps: [seconds],
          filename: outputFilename,
          folder: os.tmpdir(),
          size: "320x180",
        });
    });

    // fluent-ffmpeg may append suffixes like "-1" to the filename.
    const dir = os.tmpdir();
    const candidates = [
      outputFilename,
      `${outputBase}-1.jpg`,
      `${outputBase}-0001.jpg`,
    ];

    for (const candidate of candidates) {
      try {
        const candidatePath = path.join(dir, candidate);
        const buf = await fs.readFile(candidatePath);
        resolvedOutputPath = candidatePath;
        return buf;
      } catch (_) {
        // try next candidate
      }
    }

    // Last resort: find any jpg that starts with our base name.
    const files = await fs.readdir(dir);
    const found = files.find(
      (f) => f.startsWith(outputBase) && f.toLowerCase().endsWith('.jpg')
    );
    if (found) {
      resolvedOutputPath = path.join(dir, found);
      return await fs.readFile(resolvedOutputPath);
    }

    return null;
  } finally {
    // Best-effort cleanup; thumbnail extraction failures should not crash uploads.
    fs.unlink(inputPath).catch(() => {});
    fs.unlink(outputPath).catch(() => {});
    if (resolvedOutputPath && resolvedOutputPath !== outputPath) {
      fs.unlink(resolvedOutputPath).catch(() => {});
    }
  }
}

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
  // 1. Unique object key inside bucket "videos" (avoid "videos/videos/..." public URLs)
  const objectKey = `${uuidv4()}.mp4`;

  // 2. Upload to MinIO first
  await uploadBuffer(objectKey, buffer, videoMeta.mimeType);

  // 3. Generate + upload thumbnail (best-effort; should never fail the request)
  let thumbnailKey = null;
  try {
    const thumbnailBuffer = await extractThumbnail(buffer, 2);
    if (thumbnailBuffer) {
      thumbnailKey = `thumbnails/${uuidv4()}.jpg`;
      await uploadBuffer(thumbnailKey, thumbnailBuffer, "image/jpeg");
    }
  } catch (thumbErr) {
    console.warn("Failed to extract thumbnail:", thumbErr.message);
    thumbnailKey = null;
  }

  // 4. Save metadata to MongoDB (fields aligned with models/video.model.js)
  const status = visibility === "private" ? "private" : "public";

  let video;
  try {
    video = await Video.create({
      owner: uploaderId,
      title,
      description: description || "",
      videoKey: objectKey,
      thumbnailKey,
      duration: videoMeta.duration,
      status,
      viewsCount: 0,
      trendingScore: 0,
    });
  } catch (dbErr) {
    // Rollback: remove the already-uploaded MinIO object
    await deleteObject(objectKey).catch(() => {});
    if (thumbnailKey) await deleteObject(thumbnailKey).catch(() => {});
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
    Video.find({ status: "public" })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("owner", "username avatarUrl")
      .lean(),
    Video.countDocuments({ status: "public" }),
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
  if (!followingIds.length) {
    return { videos: [], total: 0 };
  }
  const filter = {
    status: "public",
    owner: { $in: followingIds },
  };
  const [videos, total] = await Promise.all([
    Video.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("owner", "username avatarUrl")
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
    Video.find({ status: "public" })
      .sort({ trendingScore: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("owner", "username avatarUrl")
      .lean(),
    Video.countDocuments({ status: "public" }),
  ]);
  return { videos, total };
}

/**
 * Get a presigned download URL for a MinIO object key (stored as videoKey on the Video doc).
 * @param {string} storageKey
 */
async function generateVideoURL(storageKey) {
  return generateDownloadURL(storageKey);
}

export {
  uploadVideo,
  getPublicFeed,
  getFollowingFeed,
  getTrendingFeed,
  generateVideoURL,
};