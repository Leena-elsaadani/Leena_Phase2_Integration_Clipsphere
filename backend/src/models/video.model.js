import mongoose from 'mongoose';

const videoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'A video must have a title'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A video must have an owner'],
    },

    videoKey: {
      type: String,
      default: null,
    },

    // Optional MinIO object key for a generated JPEG thumbnail (e.g. "thumbnails/<uuid>.jpg")
    thumbnailKey: {
      type: String,
      default: null,
    },

    duration: {
      type: Number,
      required: [true, 'Duration is required'],
      max: [300, 'Video duration cannot exceed 300 seconds (5 minutes)'],
      min: [1, 'Duration must be at least 1 second'],
    },

    viewsCount: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ['public', 'private', 'flagged'],
      default: 'public',
    },

    // Bonus: trending score field
    trendingScore: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Video = mongoose.model('Video', videoSchema);

export default Video;