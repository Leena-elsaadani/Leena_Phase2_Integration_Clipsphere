import mongoose from 'mongoose';

const videoSchema = new mongoose.Schema(
  {
    // video's title (required)
    title: {
      type: String,
      required: [true, 'A video must have a title'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },

    // description of the video (optional)
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },

    // Reference to the User who uploaded this video
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A video must have an owner'],
    },

    // The MinIO object key (the "filename" in storage)
    // this is just metadata 
    videoKey: {
      type: String,
      default: null,
    },

    // Duration in seconds
    duration: {
      type: Number,
      required: [true, 'Duration is required'],
      max: [300, 'Video duration cannot exceed 300 seconds (5 minutes)'],
      min: [1, 'Duration must be at least 1 second'],
    },

    // How many times this video has been viewed
    viewsCount: {
      type: Number,
      default: 0,
    },

    // Status of the video (mod)
    // 'public'  = visible to everyone
    // 'private' = only visible to the owner
    // 'flagged' = admin has flagged it for review
    status: {
      type: String,
      enum: ['public', 'private', 'flagged'],
      default: 'public',
    },
  },
  {
    // Mongoose automatically adds createdAt and updatedAt timestamps
    timestamps: true,
  }
);

// Create and export the model
const Video = mongoose.model('Video', videoSchema);

export default Video;