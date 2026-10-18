const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');

jest.mock('../models', () => ({
  Order: { find: jest.fn() },
  Shareholder: {
    find: jest.fn(),
    findById: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
  User: { findById: jest.fn() },
  WalletAuditLog: { create: jest.fn() },
}));

const {
  Order, Shareholder, User, WalletAuditLog,
} = require('../models');
const shareholderRoutes = require('../routes/shareholderRoutes');
const errorMiddleware = require('../middlewares/errorMiddleware');

const secret = 'shareholders-integration-test-secret';
const actorId = '65b000000000000000000001';
const shareholderId = '65b000000000000000000002';
const actor = {
  _id: { toString: () => actorId },
  isActive: true,
  roleId: {
    name: 'Super Admin',
    permissions: ['shareholders:read', 'pos:write', 'wallet-logs:read', 'wallet-logs:write'],
  },
};

function createChain(value) {
  const chain = {
    select: jest.fn(() => chain),
    sort: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    lean: jest.fn(() => Promise.resolve(value)),
  };
  return chain;
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/shareholders', shareholderRoutes);
  app.use(errorMiddleware);
  return app;
}

describe('shareholder endpoints', () => {
  const app = createApp();
  const mirroredShareholders = new Map();
  const auth = { Authorization: `Bearer ${jwt.sign({ sub: actorId }, secret)}` };

  beforeEach(() => {
    process.env.JWT_SECRET = secret;
    process.env.PROBASHI_MODE = 'mock';
    jest.clearAllMocks();
    mirroredShareholders.clear();
    User.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(actor) });
    WalletAuditLog.create.mockResolvedValue({});
    Shareholder.findOneAndUpdate.mockImplementation(async (selector, update) => {
      const record = { _id: shareholderId, ...update.$set };
      mirroredShareholders.set(selector.memberId, record);
      return record;
    });
    Order.find.mockReturnValue(createChain([]));
  });

  it('verifies and mirrors searches by member ID or mobile', async () => {
    const byId = await request(app).get('/api/shareholders?memberId=PB-1').set(auth);
    const byMobile = await request(app).get('/api/shareholders?mobile=01700000001').set(auth);

    expect(byId.status).toBe(200);
    expect(byMobile.status).toBe(200);
    expect(byId.body.shareholders[0]).toMatchObject({
      memberId: 'PB-1',
      status: 'valid',
      purchases: [],
    });
    expect(Shareholder.findOneAndUpdate).toHaveBeenNthCalledWith(
      1,
      { memberId: 'PB-1' },
      { $set: expect.objectContaining({ memberId: 'PB-1', verified: true }) },
      expect.objectContaining({ upsert: true, runValidators: true }),
    );
    expect(Shareholder.findOneAndUpdate).toHaveBeenNthCalledWith(
      2,
      { memberId: 'MOCK-01700000001' },
      { $set: expect.objectContaining({ mobile: '01700000001', verified: true }) },
      expect.objectContaining({ upsert: true, runValidators: true }),
    );
    expect((await request(app).get('/api/shareholders').set(auth)).status).toBe(400);
  });

  it.each([
    ['PB0007', 'valid'],
    ['INACTIVE001', 'inactive'],
    ['INVALID001', 'invalid'],
    ['WALLET_DISABLED01', 'wallet disabled'],
  ])('returns %s with %s status and purchase history', async (memberId, status) => {
    const purchases = [{ orderNumber: `ORDER-${memberId}` }];
    Order.find.mockReturnValue(createChain(purchases));

    const response = await request(app).get(`/api/shareholders?memberId=${memberId}`).set(auth);

    expect(response.status).toBe(200);
    expect(response.body.shareholders).toHaveLength(1);
    expect(response.body.shareholders[0]).toMatchObject({
      memberId,
      status,
      purchases,
    });
    expect(Shareholder.findOneAndUpdate).toHaveBeenCalledWith(
      { memberId },
      { $set: expect.objectContaining({ memberId }) },
      expect.objectContaining({ upsert: true, runValidators: true }),
    );
  });

  it('keeps one mirrored record after repeated searches', async () => {
    await request(app).get('/api/shareholders?memberId=PB0007').set(auth);
    await request(app).get('/api/shareholders?memberId=PB0007').set(auth);

    expect(Shareholder.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(mirroredShareholders.size).toBe(1);
    expect(mirroredShareholders.has('PB0007')).toBe(true);
  });

  it('verifies and mirrors a valid shareholder and audits the call', async () => {
    const response = await request(app).post('/api/shareholders/verify').set(auth).send({
      memberId: 'PB-1',
      mobile: '01700000001',
    });

    expect(response.status).toBe(200);
    expect(response.body.member).toMatchObject({ valid: true, active: true, walletEnabled: true });
    expect(Shareholder.findOneAndUpdate).toHaveBeenCalledWith(
      { memberId: 'PB-1' },
      { $set: expect.objectContaining({ memberId: 'PB-1', mobile: '01700000001' }) },
      expect.objectContaining({ upsert: true, runValidators: true }),
    );
    expect(WalletAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      memberId: 'PB-1', action: 'MEMBER_VERIFY', succeeded: true,
    }));
  });

  it('returns purchase history for a mirrored shareholder', async () => {
    const purchases = [{ orderNumber: 'PB-ORDER-1' }];
    Shareholder.findById.mockReturnValue(createChain({ _id: shareholderId }));
    Order.find.mockReturnValue(createChain(purchases));

    const response = await request(app).get(`/api/shareholders/${shareholderId}/purchases`).set(auth);

    expect(response.status).toBe(200);
    expect(response.body.purchases).toEqual(purchases);
    expect(Order.find).toHaveBeenCalledWith({ memberId: shareholderId });
  });

  it('exposes only the wallet sufficiency boolean and records each wallet action', async () => {
    const balance = await request(app).post('/api/shareholders/balance-check').set(auth)
      .send({ memberId: 'PB-1', amount: 25 });
    const report = await request(app).get('/api/shareholders/PB-1/transactions').set(auth);
    const refund = await request(app).post('/api/shareholders/refund').set(auth)
      .send({ memberId: 'PB-1', transactionId: 'TX-1', amount: 25 });

    expect(balance.status).toBe(200);
    expect(balance.body).toEqual({ success: true, sufficient: true });
    expect(report.body.transactions).toEqual([]);
    expect(refund.body.refunded).toBe(true);
    expect(WalletAuditLog.create.mock.calls.map(([entry]) => entry.action)).toEqual([
      'WALLET_BALANCE_CHECK', 'TRANSACTION_REPORT', 'REFUND',
    ]);
  });

  it('rejects unauthenticated and unauthorized requests', async () => {
    const unauthenticated = await request(app).get('/api/shareholders?memberId=PB-1');
    expect(unauthenticated.status).toBe(401);

    User.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        ...actor, roleId: { name: 'Cashier', permissions: [] },
      }),
    });
    const unauthorized = await request(app).post('/api/shareholders/verify').send({ memberId: 'PB-1' })
      .set(auth);
    expect(unauthorized.status).toBe(403);
  });
});
