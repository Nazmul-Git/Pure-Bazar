function authorizeMiddleware({ roles = [], permissions = [] } = {}) {
  return (req, res, next) => {
    if (!req.user) {
      const error = new Error('Authentication required');
      error.status = 401;
      return next(error);
    }

    if (roles.length && !roles.includes(req.user.role)) {
      const error = new Error('Insufficient role permissions');
      error.status = 403;
      return next(error);
    }

    const userPermissions = Array.isArray(req.user.permissions) ? req.user.permissions : [];
    if (!userPermissions.includes('*') && !permissions.every((permission) => userPermissions.includes(permission))) {
      const error = new Error('Insufficient permissions');
      error.status = 403;
      return next(error);
    }

    return next();
  };
}

module.exports = authorizeMiddleware;