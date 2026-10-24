const { AuditLog, Role, User } = require('../models');
const { expandPermissions } = require('../config/permissionCatalog');

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
    const roles = await Role.find().sort({ name: 1 }).lean();
    return res.json({ success: true, roles });
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const permissions = expandPermissions(['dashboard:read', ...(req.body.permissions || [])]);
    const role = await Role.create({ name: req.body.name, permissions });
    await AuditLog.create({
      actorId: req.user._id, action: 'CREATE', entity: 'Role', entityId: role._id,
      after: { name: role.name, permissions: role.permissions }, ipAddress: req.ip,
    });
    return res.status(201).json({ success: true, role });
  } catch (error) {
    return handleError(error, next);
  }
}

async function update(req, res, next) {
  try {
    const currentRole = await Role.findById(req.params.id);
    if (!currentRole) throw statusError('Role not found', 404);
    if (currentRole.name === 'Super Admin') throw statusError('The Super Admin role cannot be modified', 403);
    const before = { name: currentRole.name, permissions: currentRole.permissions };
    const role = await Role.findByIdAndUpdate(req.params.id, {
      name: req.body.name,
      permissions: expandPermissions(req.body.permissions || []),
    }, { new: true, runValidators: true });
    await AuditLog.create({
      actorId: req.user._id, action: 'UPDATE', entity: 'Role', entityId: role._id, before,
      after: { name: role.name, permissions: role.permissions }, ipAddress: req.ip,
    });
    return res.json({ success: true, role });
  } catch (error) {
    return handleError(error, next);
  }
}

async function remove(req, res, next) {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) throw statusError('Role not found', 404);
    if (role.name === 'Super Admin') throw statusError('The Super Admin role cannot be deleted', 403);
    if (await User.exists({ roleId: role._id })) throw statusError('Role is assigned to users and cannot be deleted', 409);
    await Role.findByIdAndDelete(role._id);
    await AuditLog.create({
      actorId: req.user._id, action: 'DELETE', entity: 'Role', entityId: role._id,
      before: { name: role.name, permissions: role.permissions }, ipAddress: req.ip,
    });
    return res.json({ success: true, message: 'Role deleted successfully' });
  } catch (error) {
    return handleError(error, next);
  }
}

module.exports = { list, create, update, remove };