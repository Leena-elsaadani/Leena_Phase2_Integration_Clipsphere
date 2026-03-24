import { getPlatformStats as getPlatformStatsService, updateUserStatus as updateUserStatusService, getModerationQueue as getModerationQueueService, getHealthStatus as getHealthStatusService } from '../services/admin.service.js';

// GET /api/v1/admin/stats
export const getPlatformStats = async (req, res) => {
  const stats = await getPlatformStatsService();
  res.status(200).json({
    status: 'success',
    data: stats,
  });
};

// PATCH /api/v1/admin/users/:id/status
export const updateUserStatus = async (req, res) => {
  const user = await updateUserStatusService(req.params.id, req.body.status);
  res.status(200).json({
    status: 'success',
    data: { user },
  });
};

// GET /api/v1/admin/moderation
export const getModerationQueue = async (req, res) => {
  const queue = await getModerationQueueService();
  res.status(200).json({
    status: 'success',
    data: queue,
  });
};

// GET /api/v1/admin/health
export const getHealthStatus = async (req, res) => {
  const health = await getHealthStatusService();
  res.status(200).json({
    status: 'success',
    data: health,
  });
};
