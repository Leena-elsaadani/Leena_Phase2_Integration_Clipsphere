/**
 * middleware/videoUpload.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Two-stage middleware:
 *   1. multer  → parses multipart/form-data, keeps file in memory (buffer)
 *   2. validateVideoDuration → uses ffprobe to reject videos > MAX_VIDEO_DURATION_SEC
 *
 * We store in memory (not disk) so we can pipe straight to MinIO after
 * validation — no temp files left on the server.
 */

import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobePath from "ffprobe-static";

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath.path);
import { Readable } from "stream";

const MAX_SIZE_BYTES =
  parseInt(process.env.MAX_FILE_SIZE_MB || "200", 10) * 1024 * 1024;
const MAX_DURATION_SEC = parseInt(process.env.MAX_VIDEO_DURATION_SEC || "300", 10);

// ── Multer config ─────────────────────────────────────────────────────────────

const storage = multer.memoryStorage(); // buffer in req.file.buffer

const fileFilter = (_req, file, cb) => {
  if (file.mimetype === "video/mp4") {
    cb(null, true);
  } else {
    cb(new Error("Only video/mp4 files are accepted"), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter,
});

/** Expose single-file upload as named middleware */
const uploadSingle = upload.single("video"); // field name in FormData

// ── ffprobe duration validator ────────────────────────────────────────────────

/**
 * Wraps ffprobe in a Promise.
 * ffprobe can analyse a Readable stream so we convert the Buffer.
 */
function probeBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const stream = Readable.from(buffer);
    ffmpeg(stream).ffprobe((err, metadata) => {
      if (err) return reject(new Error(`ffprobe failed: ${err.message}`));
      resolve(metadata);
    });
  });
}

/**
 * Express middleware — must run AFTER uploadSingle.
 * Attaches `req.videoMetadata` for use downstream.
 */
async function validateVideoDuration(req, res, next) {
  try {
    if (!req.file) return next(); // let controller handle missing file

    const metadata = await probeBuffer(req.file.buffer);
    const duration = metadata.format?.duration ?? 0;

    if (duration > MAX_DURATION_SEC) {
      return res.status(400).json({
        success: false,
        message: `Video duration (${Math.round(duration)}s) exceeds the ${MAX_DURATION_SEC}s limit.`,
      });
    }

    // Attach for use in the controller
    req.videoMetadata = {
      duration,
      fileSizeBytes: req.file.size,
      mimeType: req.file.mimetype,
    };

    next();
  } catch (err) {
    next(err);
  }
}

export { uploadSingle, validateVideoDuration };