import userService from "../services/user.service.js";

export const getMe = async (req, res, next) => {
  try {
    const user = await userService.getMe(req.user.id);
    res.json({ status: 'success', data: { user } });
  } catch (error) {
    next(error);
  }
};

export const updateMe = async (req, res, next) => {
  try {
    const user = await userService.updateMe(req.user.id, req.body);
    res.json({ status: 'success', data: { user } });
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const user = await userService.getMe(req.params.id);
    res.json({ status: 'success', data: { user } });
  } catch (error) {
    next(error);
  }
};

export const followUser = async (req, res, next) => {
  try {
    const result = await userService.followUser(req.user.id, req.params.id);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const unfollowUser = async (req, res, next) => {
  try {
    const result = await userService.unfollowUser(req.user.id, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getFollowers = async (req, res, next) => {
  try {
    const followers = await userService.getFollowers(req.params.id);
    res.json(followers);
  } catch (error) {
    next(error);
  }
};

export const getFollowing = async (req, res, next) => {
  try {
    const following = await userService.getFollowing(req.params.id);
    res.json(following);
  } catch (error) {
    next(error);
  }
};

export const updateNotificationPreferences = async (req, res, next) => {
  try {
    const prefs = await userService.updateNotificationPreferences(
      req.user.id,
      req.body
    );
    res.json(prefs);
  } catch (error) {
    next(error);
  }
};