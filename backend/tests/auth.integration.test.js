const bcrypt = require('bcryptjs');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');

jest.mock('../models', () => ({
  AuditLog: { create: jest.fn().mockResolvedValue({}) },
  User: { findById: jest.fn(), findOne: jest.fn() },
}));

const { AuditLog, User } = require('../models');
const authRoutes = require('../routes/authRoutes');
const errorMiddleware = require('../middlewares/errorMiddleware');

const secret = 'auth-integration-test-secret-that-is-long-enough';
const userId = '65b000000000000000000001';
const roleId = '65b000000000000000000002';
const user = {
  _id: { toString: () => userId },
  name: 'Admin User',
  email: 'admin@example.test',
  passwordHash: bcrypt.hashSync('correct-password', 4),
  isActive: true,
  roleId: { _id: { toString: () => roleId }, name: 'Super Admin', permissions: ['*'] },
};

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use(errorMiddleware);
  return app;
}

describe('auth endpoints', () => {
  const app = createApp();

  beforeEach(() => {
    process.env.JWT_SECRET = secret;
    User.findById.mockReset();
    User.findOne.mockReset();
    AuditLog.create.mockClear();
    User.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(user) }),
    });
    User.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(user) });
  });

  it('logs in with valid credentials and returns a bearer token and safe user profile', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ADMIN@example.test', password: 'correct-password' });

    expect(response.status).toBe(200);
    expect(response.headers.authorization).toMatch(/^Bearer /);
    expect(response.body).toMatchObject({
      success: true,
      user: { id: userId, name: 'Admin User', email: 'admin@example.test', role: 'Super Admin' },
    });
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(jwt.verify(response.body.token, secret).sub).toBe(userId);
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'LOGIN', actorId: user._id }));
  });

  it('rejects invalid credentials without revealing whether the account exists', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.test', password: 'incorrect-password' });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ success: false, message: 'Invalid email or password' });
    expect(response.headers.authorization).toBeUndefined();
    expect(AuditLog.create).toHaveBeenCalledTimes(1);
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'LOGIN_FAILED', entity: 'User',
    }));
    expect(AuditLog.create).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'LOGIN' }));
  });

  it('protects /me and logout, and accepts a valid bearer token', async () => {
    const denied = await request(app).get('/api/auth/me');
    const token = jwt.sign({ sub: userId }, secret, { expiresIn: '1h' });
    const profile = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    const loggedOut = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`);

    expect(denied.status).toBe(401);
    expect(profile.status).toBe(200);
    expect(profile.body.user).toMatchObject({ id: userId, email: 'admin@example.test' });
    expect(loggedOut.status).toBe(200);
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'LOGOUT', actorId: user._id }));
  });
});