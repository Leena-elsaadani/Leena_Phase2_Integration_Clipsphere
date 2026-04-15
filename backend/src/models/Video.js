/**
 * models/Video.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Mongoose schema for a ClipSphere video document.
 */

import mongoose from "mongoose";

const videoSchema = new mongoose.Schema(
  {
    // ── Ownership ──────────────────────────────────────────────────────────
    uploader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ── Metadata ───────────────────────────────────────────────────────────
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
      default: "",
    },
    tags: [{ type: String, trim: true, lowercase: true }],

    // ── Storage ────────────────────────────────────────────────────────────
    /** MinIO object key, e.g. "videos/abc123.mp4" */
    objectKey: {
      type: String,
      required: true,
      unique: true,
    },
    /** Optional thumbnail object key */
    thumbnailKey: {
      type: String,
      default: null,
    },

    // ── Video properties ───────────────────────────────────────────────────
    duration: {
      type: Number, // seconds
      required: true,
    },
    fileSizeBytes: {
      type: Number,
      required: true,
    },
    mimeType: {
      type: String,
      default: "video/mp4",
    },

    // ── Visibility ─────────────────────────────────────────────────────────
    visibility: {
      type: String,
      enum: ["public", "private", "unlisted"],
      default: "public",
      index: true,
    },

    // ── Engagement ─────────────────────────────────────────────────────────
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    dislikes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },

    /** Computed engagement score for trending sort */
    engagementScore: { type: Number, default: 0, index: true },
  },
  {
    timestamps: true, // adds createdAt, updatedAt
  }
);

// ── Compound indexes ──────────────────────────────────────────────────────────
videoSchema.index({ visibility: 1, createdAt: -1 });         // feed query
videoSchema.index({ visibility: 1, engagementScore: -1 });   // trending query
videoSchema.index({ uploader: 1, createdAt: -1 });           // user profile

/**
 * Recompute engagementScore before saving.
 * Simple formula: views*1 + likes*3 + comments*2
 */
videoSchema.pre("save", function (next) {
  this.engagementScore = this.views * 1 + this.likes * 3 + this.comments * 2;
  next();
});

export default mongoose.model("Video", videoSchema);