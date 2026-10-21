const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');

jest.mock('../models', () => ({
  Shareholder: { findOne: jest.fn() },
  User: { findById: jest.fn() },
  WalletAuditLog: { create: jest.fn() },
  WalletLog: { find: jest.fn() },
}));

const {
  Shareholder, User, WalletLog,
} = require('../models');
const shareholderRoutes = require('../routes/shareholderRoutes');
const errorMiddleware = require('../middlewares/errorMiddleware');

const secret = 'wallet-logs-test-secret';
const userId = '65c000000000000000000001';
const shareholderId = '65c000000000000000000002';
const log = {
  _id: '65c000000000000000000003',
  type: 'DEBIT',
  amount: 12.5,
  memberId: { memberId: 'PB-100', name: 'Test Member' },
  orderId: { orderNumber: 'BILL-100' },
};

function createChain(value) {
  const chain = {
    select: jest.fn(() => chain),
    sort: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    populate: jest.fn(() => chain),
    lean: jest.fn(() => Promise.resolve(value)),
  };
  return chain;
}

describe('wallet bill log API', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/shareholders', shareholderRoutes);
  app.use(errorMiddleware);
  const auth = { Authorization: `Bearer ${jwt.sign({ sub: userId }, secret)}` };
  let permissions;

  beforeEach(() => {
    process.env.JWT_SECRET = secret;
    jest.clearAllMocks();
    permissions = ['wallet-logs:read'];
    User.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        _id: userId,
        isActive: true,
        roleId: { _id: userId, name: 'Finance', permissions },
      }),
    });
    Shareholder.findOne.mockReturnValue(createChain({ _id: shareholderId }));
    WalletLog.find.mockReturnValue(createChain([log]));
  });

  it('lists bounded wallet logs filtered by Dhaka business date and member', async () => {
    const response = await request(app)
      .get('/api/shareholders/wallet-logs?date=2026-03-10&memberId=PB-100')
      .set(auth);

    expect(response.status).toBe(200);
    expect(response.body.logs).toEqual([log]);
    expect(Shareholder.findOne).toHaveBeenCalledWith({ memberId: 'PB-100' });
    expect(WalletLog.find).toHaveBeenCalledWith({
      memberId: shareholderId,
      createdAt: {
        $gte: new Date('2026-03-09T18:00:00.000Z'),
        $lt: new Date('2026-03-10T18:00:00.000Z'),
      },
    });
    const query = WalletLog.find.mock.results[0].value;
    expect(query.limit).toHaveBeenCalledWith(500);
    expect(query.populate).toHaveBeenCalledWith('memberId', 'memberId name mobile');
    expect(query.populate).toHaveBeenCalledWith('orderId', 'orderNumber soldAt grandTotal paymentStatus');
  });

  it('returns an empty list for an unknown member and validates permission and date', async () => {
    Shareholder.findOne.mockReturnValue(createChain(null));
    const missingMember = await request(app)
      .get('/api/shareholders/wallet-logs?memberId=UNKNOWN')
      .set(auth);
    expect(missingMember.status).toBe(200);
    expect(missingMember.body.logs).toEqual([]);
    expect(WalletLog.find).not.toHaveBeenCalled();

    expect((await request(app).get('/api/shareholders/wallet-logs?date=bad').set(auth)).status).toBe(400);
    permissions.length = 0;
    expect((await request(app).get('/api/shareholders/wallet-logs').set(auth)).status).toBe(403);
  });
});
