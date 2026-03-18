import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import Follower from "../models/follower.model.js";

const getMe = async (userId) => {
  const user = await User.findById(userId);

  if (!user) throw new ApiError(404, "User not found");

  return user;
};

const ALLOWED_UPDATE_FIELDS = ["username", "bio", "avatarUrl"];

const updateMe = async (userId, data) => {
  // Strip any fields the user is not allowed to change
  const updates = Object.fromEntries(
    Object.entries(data).filter(([key]) => ALLOWED_UPDATE_FIELDS.includes(key))
  );

  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, "No valid fields provided for update");
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!user) throw new ApiError(404, "User not found");

  return user;
};

const followUser = async (followerId, targetId) => {
  if (followerId === targetId) {
    throw new ApiError(400, "You cannot follow yourself");
  }

  const targetUser = await User.findById(targetId);
  if (!targetUser) throw new ApiError(404, "User not found");

  const alreadyFollowing = await Follower.findOne({
    follower: followerId,
    following: targetId
  });

  if (alreadyFollowing) {
    throw new ApiError(409, "You are already following this user");
  }

  await Follower.create({ follower: followerId, following: targetId });

  return { message: "Followed successfully" };
};

const unfollowUser = async (followerId, targetId) => {
  if (followerId === targetId) {
    throw new ApiError(400, "You cannot unfollow yourself");
  }

  const relationship = await Follower.findOneAndDelete({
    follower: followerId,
    following: targetId
  });

  if (!relationship) {
    throw new ApiError(404, "You are not following this user");
  }

  return { message: "Unfollowed successfully" };
};

const getFollowers = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  const followers = await Follower.find({ following: userId })
    .populate("follower", "username avatarUrl bio")
    .sort({ createdAt: -1 });

  return followers.map((f) => f.follower);
};

const getFollowing = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  const following = await Follower.find({ follower: userId })
    .populate("following", "username avatarUrl bio")
    .sort({ createdAt: -1 });

  return following.map((f) => f.following);
};

const ALLOWED_NOTIFICATION_FIELDS = ["newFollower", "newComment", "newLike"];

const updateNotificationPreferences = async (userId, preferences) => {
  const updates = Object.fromEntries(
    Object.entries(preferences).filter(([key]) =>
      ALLOWED_NOTIFICATION_FIELDS.includes(key)
    )
  );

  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, "No valid notification preference fields provided");
  }

  // Build a $set payload scoped to the notificationPreferences subdocument
  const setPayload = Object.fromEntries(
    Object.entries(updates).map(([key, val]) => [
      `notificationPreferences.${key}`,
      val
    ])
  );

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: setPayload },
    { new: true, runValidators: true }
  );

  if (!user) throw new ApiError(404, "User not found");

  return user.notificationPreferences;
};

export default {
  getMe,
  updateMe,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  updateNotificationPreferences
};








