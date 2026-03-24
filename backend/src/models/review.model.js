import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    // The star rating — 1 to 5
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1 star'],
      max: [5, 'Rating cannot exceed 5 stars'],
    },

    // Optional text comment
    comment: {
      type: String,
      trim: true,
      maxlength: [500, 'Comment cannot exceed 500 characters'],
    },

    // Which user wrote this review
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A review must belong to a user'],
    },

    // Which video this review is for
    video: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Video',
      required: [true, 'A review must belong to a video'],
    },
  },
  {
    timestamps: true,
  }
);

// COMPOUND UNIQUE INDEX
// This tells MongoDB: "the combination of (user + video) must be unique"
// This means one user can only submit ONE review per video
// If they try again, MongoDB throws a duplicate key error (code 11000)
reviewSchema.index({ user: 1, video: 1 }, { unique: true });

const Review = mongoose.model('Review', reviewSchema);

export default Review;