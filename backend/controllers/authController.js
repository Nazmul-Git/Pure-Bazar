const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { AuditLog, User } = require('../models');

function publicUser(user) {
  const role = user.roleId && typeof user.roleId === 'object' ? user.roleId : null;
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: role?.name || null,
    roleId: role?._id?.toString() || user.roleId?.toString() || null,
    permissions: Array.isArray(role?.permissions) ? role.permissions : [],
  };
}

async function login(req, res, next) {
  try {
    const email = req.body.email.trim().toLowerCase();
    console.log('[auth.login] query email:', email);
    const user = await User.findOne({ email }).select('+passwordHash').populate('roleId');
    console.log('[auth.login] user found:', Boolean(user));
    const hasPasswordHash = typeof user?.passwordHash === 'string' && user.passwordHash.length > 0;
    console.log(
      '[auth.login] passwordHash status:',
      user?.passwordHash === undefined ? 'undefined' : hasPasswordHash ? 'hash present' : 'missing or invalid',
    );
    const passwordMatches = hasPasswordHash
      ? await bcrypt.compare(req.body.password, user.passwordHash)
      : false;
    console.log('[auth.login] bcrypt.compare result:', passwordMatches);

    if (!user || !passwordMatches || !user.isActive) {
      const error = new Error('Invalid email or password');
      error.status = 401;
      throw error;
    }

    const token = jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '8h' });
    await AuditLog.create({
      actorId: user._id,
      action: 'LOGIN',
      entity: 'User',
      entityId: user._id,
      ipAddress: req.ip,
    });

    res.set('Authorization', `Bearer ${token}`);
    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, user: publicUser(user), token });
  } catch (error) {
    return next(error);
  }
}

function me(req, res) {
  res.set('Cache-Control', 'no-store');
  return res.json({ success: true, user: req.user });
}

async function logout(req, res, next) {
  try {
    await AuditLog.create({
      actorId: req.user._id,
      action: 'LOGOUT',
      entity: 'User',
      entityId: req.user._id,
      ipAddress: req.ip,
    });
    res.set('Authorization', '');
    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    return next(error);
  }
}

module.exports = { login, me, logout };