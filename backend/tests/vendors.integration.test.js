const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');

jest.mock('../models', () => ({
  AuditLog: { create: jest.fn() },
  User: { findById: jest.fn() },
  Vendor: { create: jest.fn(), find: jest.fn(), findById: jest.fn() },
  WalletAuditLog: { create: jest.fn() },
}));

jest.mock('../services/probashiWalletService', () => ({
  verifyMember: jest.fn(),
}));

const {
  AuditLog, User, Vendor, WalletAuditLog,
} = require('../models');
const probashiWalletService = require('../services/probashiWalletService');
const vendorRoutes = require('../routes/vendorRoutes');
const errorMiddleware = require('../middlewares/errorMiddleware');

const secret = 'vendor-registration-integration-test-secret';
const adminId = '65b000000000000000000001';
const vendorId = new mongoose.Types.ObjectId();
const admin = {
  _id: adminId,
  isActive: true,
  roleId: { name: 'Super Admin', permissions: ['*'] },
};
const form = {
  memberId: 'PB-001',
  name: 'Example Member',
  mobile: '01700000000',
  shopName: 'Example Shop',
  address: 'Dhaka',
  productCategory: 'Groceries',
  payoutMethod: 'Bank',
  accountDetails: 'Account 123',
  termsAccepted: true,
  termsVersion: '2',
};

function vendorDocument(data) {
  return {
    ...data,
    _id: data._id || vendorId,
    status: data.status || 'Active',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    toObject() {
      return {
        ...this,
        toObject: undefined,
        save: undefined,
      };
    },
    async save() {},
  };
}

function listQuery(result) {
  const query = {
    sort: jest.fn(() => query),
    lean: jest.fn(async () => result),
  };
  return query;
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/vendors', vendorRoutes);
  app.use(errorMiddleware);
  return app;
}

describe('vendor registration and directory endpoints', () => {
  const app = createApp();
  const auth = {
    Authorization: `Bearer ${jwt.sign({ sub: adminId }, secret, { expiresIn: '1h' })}`,
  };

  beforeEach(() => {
    process.env.JWT_SECRET = secret;
    jest.clearAllMocks();
    User.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(admin) });
    AuditLog.create.mockResolvedValue({});
    WalletAuditLog.create.mockResolvedValue({});
    Vendor.create.mockImplementation(async ([data]) => [vendorDocument(data)]);
    Vendor.find.mockReturnValue(listQuery([vendorDocument(form)]));
    Vendor.findById.mockResolvedValue(null);
    probashiWalletService.verifyMember.mockResolvedValue({
      memberId: form.memberId,
      valid: true,
      active: true,
      walletEnabled: true,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('verifies and registers a valid wallet-enabled member with the accepted terms version', async () => {
    const response = await request(app).post('/api/vendors').set(auth).send(form);

    expect(response.status).toBe(201);
    expect(response.body.vendor).toEqual(expect.objectContaining({
      memberId: form.memberId,
      name: form.name,
      termsAccepted: true,
      termsVersion: '2',
      status: 'Active',
    }));
    expect(probashiWalletService.verifyMember).toHaveBeenCalledWith({ memberId: form.memberId });
    expect(Vendor.create).toHaveBeenCalledWith([expect.objectContaining({
      memberId: form.memberId,
      termsVersion: '2',
      status: 'Active',
    })]);
    expect(WalletAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      memberId: form.memberId,
      action: 'MEMBER_VERIFY',
      succeeded: true,
    }));
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'CREATE',
      entity: 'Vendor',
    }));
  });

  it.each([
    ['invalid', { valid: false, active: true, walletEnabled: true }],
    ['inactive', { valid: true, active: false, walletEnabled: true }],
    ['wallet-disabled', { valid: true, active: true, walletEnabled: false }],
  ])('does not register a %s member', async (state, memberState) => {
    probashiWalletService.verifyMember.mockResolvedValue({
      memberId: form.memberId,
      ...memberState,
    });

    const response = await request(app).post('/api/vendors').set(auth).send(form);

    expect(response.status).toBe(403);
    expect(Vendor.create).not.toHaveBeenCalled();
    expect(WalletAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      succeeded: true,
    }));
  });

  it('lists vendor records and filters the directory by status and search text', async () => {
    const response = await request(app).get('/api/vendors?status=Active&q=shop').set(auth);

    expect(response.status).toBe(200);
    expect(response.body.vendors).toEqual([expect.objectContaining({
      memberId: form.memberId,
      shopName: form.shopName,
      status: 'Active',
    })]);
    expect(Vendor.find).toHaveBeenCalledWith(expect.objectContaining({
      status: 'Active',
      $or: expect.arrayContaining([{ shopName: /shop/i }]),
    }));
  });

  it('audits vendor status changes', async () => {
    const vendor = vendorDocument({ ...form });
    Vendor.findById.mockResolvedValue(vendor);

    const response = await request(app).patch(`/api/vendors/${vendorId}/status`)
      .set(auth).send({ status: 'Suspended' });

    expect(response.status).toBe(200);
    expect(response.body.vendor.status).toBe('Suspended');
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'UPDATE',
      entity: 'Vendor',
      metadata: { changedFields: ['status'] },
    }));
  });
});
