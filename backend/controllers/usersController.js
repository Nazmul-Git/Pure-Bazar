const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const {
  AuditLog, Location, Role, User,
} = require('../models');
const { getDefaultPosOutlet } = require('../services/posOutletService');

function publicUser(user) {
  const role = user.roleId && typeof user.roleId === 'object' ? user.roleId : null;
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    roleId: role?._id?.toString() || user.roleId?.toString() || null,
    role: role?.name || null,
    isActive: user.isActive,
    locationId: user.locationId?.toString() || null,
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

async function validateLocation(locationId) {
  if (!locationId) return;
  if (!await Location.exists({ _id: locationId })) throw statusError('Location not found', 400);
}

async function validatePosOutlet(locationId) {
  if (!locationId) return;
  if (!await Location.exists({ _id: locationId, type: 'OUTLET', isActive: { $ne: false } })) {
    throw statusError('Cashiers must be assigned to an active POS outlet', 400);
  }
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
    const isCashier = ['Cashier', 'Outlet Cashier'].includes(role.name);
    if (isCashier) await validatePosOutlet(req.body.locationId);
    else await validateLocation(req.body.locationId);
    let locationId = req.body.locationId;
    if (!locationId && isCashier) {
      const outlet = await getDefaultPosOutlet();
      if (!outlet) throw statusError('No active POS outlet is configured', 503);
      locationId = outlet._id;
    }
    const user = await User.create({
      name: req.body.name,
      email: req.body.email,
      passwordHash: await bcrypt.hash(req.body.password, 12),
      roleId: role._id,
      ...(locationId ? { locationId } : {}),
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
    if (Object.prototype.hasOwnProperty.call(req.body, 'locationId')) {
      await validateLocation(req.body.locationId);
      updates.locationId = req.body.locationId || undefined;
    }
    if (req.body.isActive !== undefined) updates.isActive = req.body.isActive;
    if (req.body.password) updates.passwordHash = await bcrypt.hash(req.body.password, 12);
    if (!mongoose.isValidObjectId(updates.roleId) || !await Role.exists({ _id: updates.roleId })) {
      throw statusError('Role not found', 400);
    }
    const previous = await User.findById(req.params.id).populate('roleId', 'name');
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
      .populate('roleId', 'name');
    if (!user) throw statusError('User not found', 404);
    const snapshot = (doc) => ({
      name: doc.name,
      email: doc.email,
      roleId: String(doc.roleId?._id || doc.roleId),
      locationId: doc.locationId ? String(doc.locationId) : null,
      isActive: doc.isActive,
    });
    await AuditLog.create({
      actorId: req.user._id,
      action: 'UPDATE',
      entity: 'User',
      entityId: user._id,
      ...(previous ? { before: snapshot(previous) } : {}),
      after: snapshot(user),
      metadata: { passwordChanged: Boolean(req.body.password) },
      ipAddress: req.ip,
    });
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