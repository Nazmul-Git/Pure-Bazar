const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { AuditLog, Role, User } = require('../models');

function publicUser(user) {
  const role = user.roleId && typeof user.roleId === 'object' ? user.roleId : null;
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    roleId: role?._id?.toString() || user.roleId?.toString() || null,
    role: role?.name || null,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

function statusError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function handleError(error, next) {
  if (error.code === 11000) error.status = 409;
  return next(error);
}

async function list(req, res, next) {
  try {
    const users = await User.find().select('-passwordHash').populate('roleId', 'name').sort({ name: 1 }).lean();
    return res.json({ success: true, users: users.map(publicUser) });
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const role = await Role.findById(req.body.roleId);
    if (!role) throw statusError('Role not found', 400);
    const user = await User.create({
      name: req.body.name,
      email: req.body.email,
      passwordHash: await bcrypt.hash(req.body.password, 12),
      roleId: role._id,
      isActive: req.body.isActive ?? true,
    });
    await AuditLog.create({ actorId: req.user._id, action: 'CREATE', entity: 'User', entityId: user._id, ipAddress: req.ip });
    user.roleId = role;
    return res.status(201).json({ success: true, user: publicUser(user) });
  } catch (error) {
    return handleError(error, next);
  }
}

async function update(req, res, next) {
  try {
    const updates = { name: req.body.name, email: req.body.email, roleId: req.body.roleId };
    if (req.body.isActive !== undefined) updates.isActive = req.body.isActive;
    if (req.body.password) updates.passwordHash = await bcrypt.hash(req.body.password, 12);
    if (!mongoose.isValidObjectId(updates.roleId) || !await Role.exists({ _id: updates.roleId })) {
      throw statusError('Role not found', 400);
    }
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
      .populate('roleId', 'name');
    if (!user) throw statusError('User not found', 404);
    await AuditLog.create({ actorId: req.user._id, action: 'UPDATE', entity: 'User', entityId: user._id, ipAddress: req.ip });
    return res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    return handleError(error, next);
  }
}

async function remove(req, res, next) {
  try {
    if (req.params.id === req.user._id.toString()) throw statusError('You cannot delete your own account', 400);
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) throw statusError('User not found', 404);
    await AuditLog.create({ actorId: req.user._id, action: 'DELETE', entity: 'User', entityId: user._id, ipAddress: req.ip });
    return res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    return handleError(error, next);
  }
}

module.exports = { list, create, update, remove };