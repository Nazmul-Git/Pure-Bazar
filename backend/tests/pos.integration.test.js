const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');

jest.mock('../models', () => ({
  AuditLog: { create: jest.fn() },
  Category: { find: jest.fn() },
  DiscountLog: { create: jest.fn() },
  Location: { findById: jest.fn() },
  Order: { create: jest.fn(), findOne: jest.fn() },
  Product: { find: jest.fn(), findOne: jest.fn() },
  Settings: { findOne: jest.fn() },
  Shareholder: { findById: jest.fn(), findOneAndUpdate: jest.fn() },
  StockMovement: { aggregate: jest.fn(), create: jest.fn() },
  User: { findById: jest.fn() },
  VendorLedger: { create: jest.fn() },
  WalletAuditLog: { create: jest.fn() },
  WalletLog: { create: jest.fn() },
}));

jest.mock('../services/probashiWalletService', () => ({
  checkWalletBalance: jest.fn(),
  verifyMember: jest.fn(),
}));

const models = require('../models');
const walletService = require('../services/probashiWalletService');
const posRoutes = require('../routes/posRoutes');
const errorMiddleware = require('../middlewares/errorMiddleware');

const secret = 'pos-integration-test-secret';
const cashierId = new mongoose.Types.ObjectId('65b000000000000000000001');
const adminId = new mongoose.Types.ObjectId('65b000000000000000000002');
const outletId = new mongoose.Types.ObjectId('65b000000000000000000003');
const productId = new mongoose.Types.ObjectId('65b000000000000000000004');
const vendorId = new mongoose.Types.ObjectId('65b000000000000000000005');
const shareholderId = new mongoose.Types.ObjectId('65b000000000000000000006');
const product = {
  _id: productId, name: 'Olive Oil', barcode: '4006381333931',
  ownerType: 'VENDOR', vendorId, vendorPrice: 60, mrp: 100, vatApplicable: false,
};

function query(value) {
  const chain = {
    select: jest.fn(() => chain),
    lean: jest.fn(() => Promise.resolve(value)),
  };
  return chain;
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/pos', posRoutes);
  app.use(errorMiddleware);
  return app;
}

describe('POS checkout API', () => {
  const app = createApp();
  let db;
  let user;
  let session;
  let failLedger;

  const auth = () => ({
    Authorization: `Bearer ${jwt.sign({ sub: user._id.toString() }, secret)}`,
  });
  const line = (quantity = 1) => [{ productId: productId.toString(), quantity }];
  const checkout = (body) => request(app).post('/api/pos/checkout').set(auth()).send(body);

  beforeEach(() => {
    process.env.JWT_SECRET = secret;
    jest.clearAllMocks();
    failLedger = false;
    db = {
      orders: [],
      movements: [{ productId, warehouseId: outletId, quantity: 10, type: 'GRN' }],
      ledgers: [],
      walletLogs: [],
      discounts: [],
      audits: [],
    };
    user = {
      _id: cashierId, isActive: true, roleId: { name: 'Cashier', permissions: ['pos:read', 'pos:write'] },
      locationId: outletId,
    };
    models.User.findById.mockReturnValue({ populate: jest.fn().mockImplementation(async () => user) });
    models.Product.find.mockReturnValue(query([product]));
    models.Product.findOne.mockReturnValue(query(product));
    models.Category.find.mockReturnValue({
      select: jest.fn(() => query([])),
    });
    models.Settings.findOne.mockReturnValue(query({
      discountLimitByRole: { Cashier: 5, 'Super Admin': 0 },
      enabledPaymentMethods: ['Cash', 'bKash', 'Nagad', 'Card', 'Wallet'],
    }));
    models.Shareholder.findById.mockReturnValue(query({
      _id: shareholderId, memberId: 'PB-001', verified: true, active: true, walletEnabled: true,
    }));
    models.Location.findById.mockReturnValue(query({ _id: outletId, type: 'OUTLET' }));
    models.Order.findOne.mockImplementation(({ offlineId }) => query(
      db.orders.find((order) => order.offlineId === offlineId) || null,
    ));
    models.Order.create.mockImplementation(async ([data]) => {
      const order = { ...data, _id: new mongoose.Types.ObjectId(), createdAt: new Date() };
      db.orders.push(order);
      return [order];
    });
    models.StockMovement.aggregate.mockImplementation((pipeline) => ({
      session: jest.fn(async () => {
        const filter = pipeline[0].$match;
        const available = db.movements
          .filter((movement) => movement.warehouseId.toString() === filter.warehouseId.toString())
          .reduce((sum, movement) => sum + movement.quantity, 0);
        return available ? [{ _id: productId, quantity: available }] : [];
      }),
    }));
    models.StockMovement.create.mockImplementation(async (rows) => {
      db.movements.push(...rows);
      return rows;
    });
    models.VendorLedger.create.mockImplementation(async (rows) => {
      if (failLedger) throw new Error('simulated ledger write failure');
      db.ledgers.push(...rows);
      return rows;
    });
    models.WalletLog.create.mockImplementation(async (rows) => {
      db.walletLogs.push(...rows);
      return rows;
    });
    models.DiscountLog.create.mockImplementation(async (rows) => {
      db.discounts.push(...rows);
      return rows;
    });
    models.AuditLog.create.mockImplementation(async (rows) => {
      db.audits.push(...rows);
      return rows;
    });
    models.WalletAuditLog.create.mockResolvedValue({});
    walletService.checkWalletBalance.mockResolvedValue({ sufficient: true });
    session = {
      withTransaction: jest.fn(async (work) => {
        const saved = Object.fromEntries(Object.entries(db).map(([key, value]) => (
          [key, [...value]]
        )));
        try {
          await work();
        } catch (error) {
          Object.assign(db, saved);
          throw error;
        }
      }),
      endSession: jest.fn(),
    };
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('blocks wallet payment without a verified shareholder', async () => {
    const response = await checkout({
      items: line(), payments: [{ method: 'WALLET', amount: 100 }],
    });
    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/verified shareholder/);
    expect(db.orders).toHaveLength(0);
    expect(walletService.checkWalletBalance).not.toHaveBeenCalled();
  });

  it('checks the final wallet total and returns MRP pricing when balance is insufficient', async () => {
    walletService.checkWalletBalance.mockResolvedValue({ sufficient: false });
    const response = await checkout({
      items: line(),
      payments: [{ method: 'WALLET', amount: 95 }],
      shareholderId: shareholderId.toString(),
    });
    expect(response.status).toBe(409);
    expect(walletService.checkWalletBalance).toHaveBeenCalledWith({ memberId: 'PB-001', amount: 95 });
    expect(response.body.bill).toMatchObject({
      subtotal: 100, shareholderDiscountAmount: 0, grandTotal: 100,
    });
    expect(db.orders).toHaveLength(0);
  });

  it('rolls back the order, stock, ledger, and audit writes on transaction failure', async () => {
    failLedger = true;
    const response = await checkout({
      items: line(), payments: [{ method: 'CASH', amount: 100 }],
    });
    expect(response.status).toBe(500);
    expect(db.orders).toHaveLength(0);
    expect(db.movements).toHaveLength(1);
    expect(db.ledgers).toHaveLength(0);
    expect(db.audits).toHaveLength(0);
    expect(session.endSession).toHaveBeenCalled();
  });

  it('records stock, vendor ledger, split payments, and receipt lines from the bill', async () => {
    const response = await checkout({
      items: line(2),
      billDiscount: { type: 'FIXED', value: 10, reason: 'Offer' },
      payments: [{ method: 'CASH', amount: 90 }, { method: 'CARD', amount: 100 }],
      shareholderId: shareholderId.toString(),
    });
    expect(response.status).toBe(201);
    expect(response.body.order).toMatchObject({
      paymentStatus: 'PAID', subtotal: 200, otherDiscountAmount: 10, grandTotal: 190,
    });
    expect(response.body.order.memberId.toString()).toBe(shareholderId.toString());
    expect(response.body.receipt.lines[0]).toMatchObject({
      quantity: 2, subtotal: 200, billDiscountAmount: 10, total: 190,
    });
    expect(db.movements.at(-1)).toMatchObject({ quantity: -2, type: 'SALE' });
    expect(db.ledgers[0]).toMatchObject({
      quantity: 2, vendorPayable: 120, companyNet: 70, entryType: 'SALE',
    });
    expect(db.discounts[0]).toMatchObject({ amount: 10, reason: 'Offer' });
  });

  it('requires a Super Admin to approve a discount above the cashier limit', async () => {
    const body = {
      items: line(),
      billDiscount: { type: 'PERCENT', value: 10, reason: 'Manager offer' },
      payments: [{ method: 'CASH', amount: 90 }],
    };
    const denied = await checkout(body);
    expect(denied.status).toBe(403);
    expect(db.orders).toHaveLength(0);

    user = {
      ...user, _id: adminId, roleId: { name: 'Super Admin', permissions: ['pos:read', 'pos:write'] },
    };
    const approved = await checkout({ ...body, discountApproved: true });
    expect(approved.status).toBe(201);
    expect(db.discounts[0].approvedBy.toString()).toBe(adminId.toString());
  });

  it('syncs non-wallet offline bills idempotently and preserves the sale time', async () => {
    const body = {
      offlineId: 'device-1-order-17',
      soldAt: '2026-10-18T09:00:00.000Z',
      items: line(),
      payments: [{ method: 'BKASH', amount: 100 }],
    };
    const walletQueue = await request(app).post('/api/pos/offline-sync').set(auth()).send({
      ...body,
      payments: [{ method: 'WALLET', amount: 95 }],
      shareholderId: shareholderId.toString(),
    });
    expect(walletQueue.status).toBe(400);
    expect(db.orders).toHaveLength(0);

    const first = await request(app).post('/api/pos/offline-sync').set(auth()).send(body);
    const duplicate = await request(app).post('/api/pos/offline-sync').set(auth()).send(body);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ synced: true, duplicate: false });
    expect(new Date(first.body.receipt.soldAt).toISOString()).toBe(body.soldAt);
    expect(duplicate.body).toMatchObject({ synced: true, duplicate: true });
    expect(db.orders).toHaveLength(1);
  });
});
