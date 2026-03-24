import ApiError from '../utils/ApiError.js';

const ownershipMiddleware = (Model, options = {}) => {
  return async (req, res, next) => {
    const resource = await Model.findById(req.params.id);

    if (!resource) {
      return next(new ApiError(404, 'Resource not found'));
    }

    // If user is admin and admins are allowed to bypass ownership
    if (options.allowAdmin && req.user.role === 'admin') {
      req.resource = resource;
      return next();
    }

    // Check if the logged-in user owns this resource
    // .toString() because MongoDB ObjectIds are objects, not strings
    if (resource.owner.toString() !== req.user.id.toString()) {
      return next(new ApiError(403, 'You do not have permission to perform this action'));
    }

    // Attach resource to request so controller can use it
    req.resource = resource;
    next();
  };
};

export default ownershipMiddleware;