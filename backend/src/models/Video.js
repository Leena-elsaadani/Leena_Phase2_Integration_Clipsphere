/**
 * DEPRECATED: This file is no longer used.
 * 
 * Use models/video.model.js instead, which provides:
 * - Complete video schema with all fields
 * - Proper indexes and validation
 * - Updated Mongoose 8+ syntax
 * 
 * Do not import or use this file.
 */

throw new Error('Video.js is deprecated. Use models/video.model.js instead');

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