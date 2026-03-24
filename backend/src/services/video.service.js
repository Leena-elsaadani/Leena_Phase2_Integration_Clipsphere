import Video from '../models/video.model.js';
import ApiError from '../utils/ApiError.js';

// CREATE a new video (metadata)
export const createVideo = async (videoData, userId) => {
  // Attach the logged-in user as the owner
  const video = await Video.create({
    ...videoData,
    owner: userId,
  });
  return video;
};

// GET all public videos (the feed)
export const getAllVideos = async (query) => {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 10;
  const skip = (page - 1) * limit;

  const videos = await Video.find({ status: 'public' })
    .populate('owner', 'username avatarKey') // Fill in owner's username, not just their ID
    .sort({ createdAt: -1 })                  // Newest first
    .skip(skip)
    .limit(limit);

  const total = await Video.countDocuments({ status: 'public' });

  return { videos, total, page, totalPages: Math.ceil(total / limit) };
};

// GET a single video by ID
export const getVideoById = async (videoId) => {
  const video = await Video.findById(videoId).populate('owner', 'username avatarKey');
  if (!video) {
    throw new ApiError(404, 'Video not found');
  }
  return video;
};

// UPDATE a video's title or description
// (Ownership is checked in middleware, not here)
export const updateVideo = async (videoId, updateData) => {
  // Only allow updating title and description 
  const allowedUpdates = {};
  if (updateData.title) allowedUpdates.title = updateData.title;
  if (updateData.description !== undefined) allowedUpdates.description = updateData.description;

  const video = await Video.findByIdAndUpdate(
    videoId,
    allowedUpdates,
    { new: true, runValidators: true } // Return the updated doc, run schema validators
  );

  if (!video) {
    throw new ApiError(404, 'Video not found');
  }

  return video;
};

// DELETE a video
// (Ownership OR admin check is in middleware)
export const deleteVideo = async (videoId) => {
  const video = await Video.findByIdAndDelete(videoId);
  if (!video) {
    throw new ApiError(404, 'Video not found');
  }
  return video;
};