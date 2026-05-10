import Video from '../models/video.model.js';
import Like from '../models/like.model.js';
import Review from '../models/review.model.js';

export const recalculateTrendingScores = async () => {
  try {
    const videos = await Video.find({ status: 'public' }).select('_id createdAt');
    
    for (const video of videos) {
      // Likes
      const likesCount = await Like.countDocuments({ video: video._id });
      
      // AvgRating
      const reviews = await Review.aggregate([
        { $match: { video: video._id } },
        { $group: { _id: null, avgRating: { $avg: '$rating' } } }
      ]);
      const avgRating = reviews.length > 0 ? reviews[0].avgRating : 0;
      
      // Freshness = 1000 / (hoursSinceCreation + 1)
      const now = new Date();
      const hoursSinceCreation = Math.abs(now - video.createdAt) / 36e5;
      const freshness = 1000 / (hoursSinceCreation + 1);
      
      const trendingScore = (likesCount * 10) + (avgRating * 2) + freshness;
      
      await Video.findByIdAndUpdate(video._id, { trendingScore });
    }
    console.log(`[Job] Recalculated trending scores for ${videos.length} videos.`);
  } catch (err) {
    console.error('[Job] Failed to recalculate trending scores:', err);
  }
};

export const startTrendingJob = () => {
  // Run every 15 minutes
  setInterval(recalculateTrendingScores, 15 * 60 * 1000);
  
  // Also run immediately on startup
  recalculateTrendingScores();
};
