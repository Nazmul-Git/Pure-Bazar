const bcrypt = require('bcryptjs');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');

jest.mock('../models', () => ({
  AuditLog: { create: jest.fn() },
  Location: { exists: jest.fn() },
  Role: {
    create: jest.fn(),
    exists: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndDelete: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
  User: {
    create: jest.fn(),
    exists: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndDelete: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

jest.mock('../services/posOutletService', () => ({
  getDefaultPosOutlet: jest.fn(),
}));

const {
  AuditLog, Location, Role, User,
} = require('../models');
const posOutletService = require('../services/posOutletService');
const roleRoutes = require('../routes/roleRoutes');
const userRoutes = require('../routes/userRoutes');
const errorMiddleware = require('../middlewares/errorMiddleware');

const secret = 'users-roles-integration-test-secret';
const adminId = '65b000000000000000000001';
const roleId = '65b000000000000000000002';
const createdUserId = '65b000000000000000000003';
const adminRole = { _id: roleId, name: 'Super Admin', permissions: ['*'] };
const admin = { _id: adminId, name: 'Admin User', email: 'admin@example.test', isActive: true, roleId: adminRole };
const role = { _id: roleId, name: 'Inventory Manager', permissions: ['products:read'] };

function chain(value) {
  const query = {
    select: () => query,
    populate: () => query,
    sort: () => query,
    lean: () => Promise.resolve(value),
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
  return query;
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/users', userRoutes);
  app.use('/api/roles', roleRoutes);
  app.use(errorMiddleware);
  return app;
}

function tokenFor(id = adminId) {
  return jwt.sign({ sub: id }, secret, { expiresIn: '1h' });
}

describe('users and roles endpoints', () => {
  const app = createApp();
  const auth = { Authorization: `Bearer ${tokenFor()}` };

  beforeEach(() => {
    process.env.JWT_SECRET = secret;
    jest.clearAllMocks();
    AuditLog.create.mockResolvedValue({});
    Location.exists.mockResolvedValue(true);
    User.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(admin) });
    User.find.mockReturnValue(chain([]));
    Role.find.mockReturnValue(chain([]));
    Role.findById.mockResolvedValue(role);
    Role.exists.mockResolvedValue(role);
    User.exists.mockResolvedValue(null);
    User.create.mockResolvedValue({ _id: createdUserId, name: 'New User', email: 'new@example.test', roleId, isActive: true });
    User.findByIdAndUpdate.mockReturnValue({ populate: jest.fn().mockResolvedValue({
      _id: createdUserId, name: 'Updated User', email: 'new@example.test', roleId: role, isActive: true,
    }) });
    User.findByIdAndDelete.mockResolvedValue({ _id: createdUserId });
    Role.create.mockResolvedValue(role);
    Role.findByIdAndUpdate.mockResolvedValue(role);
    Role.findByIdAndDelete.mockResolvedValue(role);
  });

  it('lists users and roles without exposing password hashes', async () => {
    User.find.mockReturnValue(chain([{ ...admin, roleId: adminRole, passwordHash: 'private' }]));
    Role.find.mockReturnValue(chain([role]));

    const users = await request(app).get('/api/users').set(auth);
    const roles = await request(app).get('/api/roles').set(auth);

    expect(users.status).toBe(200);
    expect(users.body.users[0]).toMatchObject({ id: adminId, role: 'Super Admin' });
    expect(users.body.users[0].passwordHash).toBeUndefined();
    expect(roles.status).toBe(200);
    expect(roles.body.roles).toEqual([role]);
  });

  it('creates users with hashed passwords and records the audit event', async () => {
    const response = await request(app).post('/api/users').set(auth).send({
      name: 'New User', email: 'new@example.test', password: 'long-password', roleId,
    });

    expect(response.status).toBe(201);
    expect(response.body.user.passwordHash).toBeUndefined();
    const savedPassword = User.create.mock.calls[0][0].passwordHash;
    expect(await bcrypt.compare('long-password', savedPassword)).toBe(true);
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'CREATE', entity: 'User' }));
  });

  it('assigns new cashiers to the active default outlet when none is selected', async () => {
    Role.findById.mockResolvedValue({ ...role, name: 'Cashier' });
    posOutletService.getDefaultPosOutlet.mockResolvedValue({ _id: '65b000000000000000000004' });

    const response = await request(app).post('/api/users').set(auth).send({
      name: 'Test Cashier', email: 'test2@example.test', password: 'long-password', roleId,
    });

    expect(response.status).toBe(201);
    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({
      locationId: '65b000000000000000000004',
    }));
  });

  it('rejects explicit cashier assignments that are not active outlets', async () => {
    Role.findById.mockResolvedValue({ ...role, name: 'Cashier' });
    Location.exists.mockResolvedValue(false);
    const response = await request(app).post('/api/users').set(auth).send({
      name: 'Test Cashier', email: 'test2@example.test', password: 'long-password', roleId,
      locationId: '65b000000000000000000004',
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/active POS outlet/);
    expect(User.create).not.toHaveBeenCalled();
  });

  it('updates and deletes users, auditing each write', async () => {
    const updated = await request(app).put(`/api/users/${createdUserId}`).set(auth).send({
      name: 'Updated User', email: 'new@example.test', roleId, isActive: true,
    });
    const removed = await request(app).delete(`/api/users/${createdUserId}`).set(auth);

    expect(updated.status).toBe(200);
    expect(updated.body.user.name).toBe('Updated User');
    expect(removed.status).toBe(200);
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'UPDATE', entity: 'User' }));
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'DELETE', entity: 'User' }));
  });

  it('stores and returns a user location assignment', async () => {
    User.create.mockResolvedValue({
      _id: createdUserId,
      name: 'Outlet User',
      email: 'outlet@example.test',
      roleId,
      locationId: '65b000000000000000000004',
      isActive: true,
    });
    const response = await request(app).post('/api/users').set(auth).send({
      name: 'Outlet User',
      email: 'outlet@example.test',
      password: 'long-password',
      roleId,
      locationId: '65b000000000000000000004',
    });

    expect(response.status).toBe(201);
    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({
      locationId: '65b000000000000000000004',
    }));
    expect(response.body.user.locationId).toBe('65b000000000000000000004');
    expect(Location.exists).toHaveBeenCalledWith({ _id: '65b000000000000000000004' });
  });

  it('creates, updates, and deletes roles with audit records', async () => {
    const createPermissions = ['pos:read', 'vendor-payouts:write'];
    const updatePermissions = ['products:read', 'settings:write'];
    const created = await request(app).post('/api/roles').set(auth).send({ name: 'Stock Viewer', permissions: createPermissions });
    const updated = await request(app).put(`/api/roles/${roleId}`).set(auth).send({ name: 'Inventory Team', permissions: updatePermissions });
    const removed = await request(app).delete(`/api/roles/${roleId}`).set(auth);

    expect(created.status).toBe(201);
    expect(updated.status).toBe(200);
    expect(removed.status).toBe(200);
    expect(Role.create).toHaveBeenCalledWith({
      name: 'Stock Viewer',
      permissions: ['dashboard:read', ...createPermissions],
    });
    expect(Role.findByIdAndUpdate).toHaveBeenCalledWith(roleId, {
      name: 'Inventory Team', permissions: updatePermissions,
    }, { new: true, runValidators: true });
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'CREATE', entity: 'Role' }));
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'UPDATE', entity: 'Role' }));
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'DELETE', entity: 'Role' }));
  });

  it('accepts shareholder write permission and always includes dashboard access on create', async () => {
    const response = await request(app).post('/api/roles').set(auth).send({
      name: 'Shareholder Manager',
      permissions: ['shareholders:read', 'shareholders:write'],
    });

    expect(response.status).toBe(201);
    expect(Role.create).toHaveBeenCalledWith({
      name: 'Shareholder Manager',
      permissions: ['dashboard:read', 'shareholders:read', 'shareholders:write'],
    });
  });

  it('rejects unknown and duplicate role permissions', async () => {
    const unknown = await request(app).post('/api/roles').set(auth).send({
      name: 'Unknown Access', permissions: ['system:root'],
    });
    const duplicate = await request(app).post('/api/roles').set(auth).send({
      name: 'Duplicate Access', permissions: ['stock:read', 'stock:read'],
    });

    expect(unknown.status).toBe(400);
    expect(duplicate.status).toBe(400);
    expect(Role.create).not.toHaveBeenCalled();
  });

  it('rejects invalid input, unauthenticated access, and non-admin users', async () => {
    const missingAuth = await request(app).get('/api/users');
    const invalid = await request(app).post('/api/users').set(auth).send({ name: 'x' });
    User.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue({
      ...admin, roleId: { name: 'Inventory Manager', permissions: ['*'] },
    }) });
    const forbidden = await request(app).get('/api/roles').set(auth);

    expect(missingAuth.status).toBe(401);
    expect(invalid.status).toBe(400);
    expect(User.create).not.toHaveBeenCalled();
    expect(forbidden.status).toBe(403);
  });

  it('protects the Super Admin role and prevents deleting assigned roles', async () => {
    Role.findById.mockResolvedValueOnce(adminRole).mockResolvedValueOnce(role);
    User.exists.mockResolvedValueOnce(true);
    const protectedRole = await request(app).delete(`/api/roles/${roleId}`).set(auth);
    const assignedRole = await request(app).delete(`/api/roles/${roleId}`).set(auth);

    expect(protectedRole.status).toBe(403);
    expect(assignedRole.status).toBe(409);
    expect(Role.findByIdAndDelete).not.toHaveBeenCalled();
  });
});