const jwt = require('jsonwebtoken');
const { User } = require('../models');

function authMiddleware(req, res, next) {
  const authorization = req.get('authorization') || '';
  const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);

  if (!tokenMatch) {
    const error = new Error('Authentication required');
    error.status = 401;
    return next(error);
  }

  if (!process.env.JWT_SECRET) {
    return next(new Error('JWT_SECRET is not configured'));
  }

  try {
    const payload = jwt.verify(tokenMatch[1], process.env.JWT_SECRET);
    const userId = payload.sub || payload.userId || payload.id;
    if (!userId) {
      const error = new Error('Invalid authentication token');
      error.status = 401;
      return next(error);
    }

    return loadUser(userId, req, next);
  } catch {
    const error = new Error('Invalid or expired authentication token');
    error.status = 401;
    return next(error);
  }
}

async function loadUser(userId, req, next) {
  try {
    const user = await User.findById(userId).populate('roleId');
    if (!user || !user.isActive) {
      const error = new Error('Authentication required');
      error.status = 401;
      return next(error);
    }

    const role = user.roleId && typeof user.roleId === 'object' ? user.roleId : null;
    req.user = {
      _id: user._id,
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: role?.name || null,
      roleId: role?._id || user.roleId,
      locationId: user.locationId || null,
      permissions: Array.isArray(role?.permissions)
        ? role.permissions
        : Array.isArray(user.permissions) ? user.permissions : [],
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = authMiddleware;