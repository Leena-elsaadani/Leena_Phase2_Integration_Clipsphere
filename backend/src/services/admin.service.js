import User from '../models/user.model.js';
import Video from '../models/video.model.js';
import Review from '../models/review.model.js';
import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';

// GET PLATFORM STATISTICS
// Uses MongoDB 
export const getPlatformStats = async () => {
  // Count all users
  const totalUsers = await User.countDocuments();

  // Count all videos
  const totalVideos = await Video.countDocuments();

  // Count flagged videos
  const flaggedVideos = await Video.countDocuments({ status: 'flagged' });

  // Get the 5 most active users this week (by video count)
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const mostActiveUsers = await Video.aggregate([
    // Only look at videos created this week
    { $match: { createdAt: { $gte: oneWeekAgo } } },

    // Group by owner, count how many videos each has
    {
      $group: {
        _id: '$owner',          // Group by the owner field
        videoCount: { $sum: 1 }, // Count each video
      },
    },

    // Sort by most videos first
    { $sort: { videoCount: -1 } },

    // Only get top 5
    { $limit: 5 },

    // Join with User collection to get username
    {
      $lookup: {
        from: 'users',       // Collection name (lowercase plural)
        localField: '_id',   // The owner ID we grouped by
        foreignField: '_id', // Match against user's _id
        as: 'userInfo',      // Store result as 'userInfo'
      },
    },

    //Flatten the array (lookup returns an array)
    { $unwind: '$userInfo' },

    // Only return what we need
    {
      $project: {
        username: '$userInfo.username',
        email: '$userInfo.email',
        videoCount: 1,
      },
    },
  ]);

  return {
    totalUsers,
    totalVideos,
    flaggedVideos,
    mostActiveUsers,
    totalTips: 0,
  };
};

// SOFT DELETE / DEACTIVATE A USER
// Sets active: false — doesn't remove the record
export const updateUserStatus = async (userId, status) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { active: status === 'active' }, // true if activating, false if deactivating
    { new: true }
  ).select('-password');

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  return user;
};

// GET MODERATION QUEUE
// Videos that are flagged OR have very low average ratings
export const getModerationQueue = async () => {
  // Find explicitly flagged videos
  const flaggedVideos = await Video.find({ status: 'flagged' })
    .populate('owner', 'username email')
    .sort({ createdAt: -1 });

  // Find videos with an average rating below 2 (poor quality)
  const lowRatedVideos = await Review.aggregate([
    // Group all reviews by video, calculate average rating
    {
      $group: {
        _id: '$video',
        avgRating: { $avg: '$rating' },
        reviewCount: { $sum: 1 },
      },
    },
    // Only keep videos with low average AND at least 3 reviews
    {
      $match: {
        avgRating: { $lte: 2 },
        reviewCount: { $gte: 3 },
      },
    },
    // Join with videos collection to get video details
    {
      $lookup: {
        from: 'videos',
        localField: '_id',
        foreignField: '_id',
        as: 'videoInfo',
      },
    },
    { $unwind: '$videoInfo' },
    {
      $project: {
        title: '$videoInfo.title',
        status: '$videoInfo.status',
        avgRating: { $round: ['$avgRating', 1] },
        reviewCount: 1,
      },
    },
  ]);

  return { flaggedVideos, lowRatedVideos };
};

// SYSTEM HEALTH CHECK
export const getHealthStatus = async () => {

  return {
    status: 'ok',
    uptime: Math.floor(process.uptime()), // Seconds since server started
    timestamp: new Date().toISOString(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
    },
    database: {
      // 1 = connected, 0 = disconnected, 2 = connecting, 3 = disconnecting
      status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    },
  };
};
