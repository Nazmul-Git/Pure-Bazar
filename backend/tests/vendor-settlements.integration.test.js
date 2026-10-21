const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');

jest.mock('../models', () => ({
  AuditLog: { create: jest.fn() },
  GoodsReceive: { updateMany: jest.fn() },
  Product: { find: jest.fn() },
  Settings: { findOne: jest.fn() },
  StockMovement: { aggregate: jest.fn() },
  User: { findById: jest.fn() },
  Vendor: { findById: jest.fn() },
  VendorLedger: { find: jest.fn() },
  VendorStatement: {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
  },
}));

const models = require('../models');
const vendorRoutes = require('../routes/vendorRoutes');
const errorMiddleware = require('../middlewares/errorMiddleware');

const secret = 'vendor-settlement-integration-test-secret';
const userId = new mongoose.Types.ObjectId('65b000000000000000000001');
const vendorId = new mongoose.Types.ObjectId('65b000000000000000000002');
const productId = new mongoose.Types.ObjectId('65b000000000000000000003');
const statementId = new mongoose.Types.ObjectId('65b000000000000000000004');
const startDate = '2026-08-01';
const endDate = '2026-08-15';
let statementStore;
let permissions;
let settings;
const entries = [
  {
    _id: new mongoose.Types.ObjectId(), vendorId, productId, orderId: new mongoose.Types.ObjectId(),
    entryType: 'SALE', quantity: 2, vendorPayable: 120, companyNet: 80,
    createdAt: new Date('2026-08-02T12:00:00.000Z'),
  },
  {
    _id: new mongoose.Types.ObjectId(), vendorId, productId, orderId: new mongoose.Types.ObjectId(),
    entryType: 'SALE', quantity: 1, vendorPayable: 50, companyNet: 25,
    createdAt: new Date('2026-08-05T12:00:00.000Z'),
  },
  {
    _id: new mongoose.Types.ObjectId(), vendorId, productId, orderId: new mongoose.Types.ObjectId(),
    entryType: 'RETURN', quantity: 1, vendorPayable: 50, companyNet: -25,
    createdAt: new Date('2026-08-07T12:00:00.000Z'),
  },
];

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/vendors', vendorRoutes);
  app.use(errorMiddleware);
  return app;
}

function query(value) {
  const chain = {
    select: jest.fn(() => chain),
    sort: jest.fn(() => chain),
    lean: jest.fn(async () => value),
  };
  return chain;
}

function statementDocument(data) {
  return {
    ...data,
    _id: data._id || statementId,
    toObject() {
      const { toObject, save, ...plain } = this;
      return { ...plain };
    },
    async save() {
      const index = statementStore.findIndex((item) => item._id.toString() === this._id.toString());
      statementStore[index] = this;
    },
  };
}

describe('vendor settlement APIs', () => {
  const app = createApp();
  const token = jwt.sign({ sub: userId.toString() }, secret);
  const auth = { Authorization: `Bearer ${token}` };

  beforeEach(() => {
    process.env.JWT_SECRET = secret;
    jest.clearAllMocks();
    statementStore = [];
    permissions = ['vendors:read', 'vendors:write', 'vendor-payouts:read', 'vendor-payouts:write'];
    settings = { vendorWalletPayoutEnabled: false, enabledVendorPayoutMethods: ['Cash', 'Bank', 'bKash', 'Nagad'] };
    models.Settings.findOne.mockReturnValue(query(settings));
    models.GoodsReceive.updateMany.mockResolvedValue({});
    models.User.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        _id: userId,
        isActive: true,
        roleId: { name: 'Finance', permissions },
      }),
    });
    models.Vendor.findById.mockReturnValue(query({ _id: vendorId }));
    models.Product.find.mockReturnValue(query([{ _id: productId, vendorPrice: 50 }]));
    models.StockMovement.aggregate.mockResolvedValue([{
      openingStock: 5,
      receipts: 4,
      closingStock: 7,
    }]);
    models.VendorLedger.find.mockImplementation((filter) => {
      const periodEntries = entries.filter((entry) => (
        entry.createdAt >= filter.createdAt.$gte && entry.createdAt < filter.createdAt.$lt
      ));
      const matching = filter.entryType
        ? periodEntries.filter((entry) => filter.entryType.$in.includes(entry.entryType))
        : periodEntries;
      return query(matching);
    });
    models.VendorStatement.findOne.mockImplementation((filter) => query(
      statementStore.find((statement) => (
        statement.vendorId.toString() === filter.vendorId.toString()
        && statement.periodStart.getTime() === filter.periodStart.getTime()
        && statement.periodEnd.getTime() === filter.periodEnd.getTime()
      )) || null
    ));
    models.VendorStatement.create.mockImplementation(async ([data]) => {
      const statement = statementDocument(data);
      statementStore.push(statement);
      return [statement];
    });
    models.VendorStatement.find.mockImplementation(() => query(statementStore));
    models.VendorStatement.findById.mockImplementation(async (id) => (
      statementStore.find((statement) => statement._id.toString() === id.toString()) || null
    ));
    models.AuditLog.create.mockResolvedValue({});
  });

  afterEach(() => jest.restoreAllMocks());

  it('returns sales and vendor payable/margin without counting returns in ledger totals', async () => {
    const response = await request(app)
      .get(`/api/vendors/${vendorId}/ledger?startDate=${startDate}&endDate=${endDate}`)
      .set(auth);

    expect(response.status).toBe(200);
    expect(response.body.entries).toHaveLength(2);
    expect(response.body.totals).toEqual({
      sales: 3,
      vendorPayable: 170,
      companyMargin: 105,
    });
  });

  it('snapshots period totals from ledger and does not recalculate after product price changes', async () => {
    const ledger = await request(app)
      .get(`/api/vendors/${vendorId}/ledger?startDate=${startDate}&endDate=${endDate}`)
      .set(auth);
    const created = await request(app)
      .post(`/api/vendors/${vendorId}/statements`)
      .set(auth)
      .send({ startDate, endDate });

    expect(created.status).toBe(201);
    expect(created.body.statement).toMatchObject({
      statementNumber: `VST-${vendorId}-20260801-20260815`,
      status: 'Draft',
      openingStock: 5,
      receipts: 4,
      sales: 3,
      returns: 1,
      closingStock: 7,
      salesValueAtVendorPrice: 170,
      netPayable: 120,
    });
    expect(created.body.statement.salesValueAtVendorPrice).toBe(ledger.body.totals.vendorPayable);
    expect(models.AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'CREATE',
      entity: 'VendorStatement',
    }));

    models.Product.find.mockReturnValue(query([{ _id: productId, vendorPrice: 99 }]));
    const listed = await request(app).get(`/api/vendors/${vendorId}/statements`).set(auth);

    expect(listed.status).toBe(200);
    expect(listed.body.statements[0]).toMatchObject({
      salesValueAtVendorPrice: 170,
      netPayable: 120,
    });
  });

  it('requires approval before payment and locks a Paid statement', async () => {
    const created = await request(app)
      .post(`/api/vendors/${vendorId}/statements`)
      .set(auth)
      .send({ startDate, endDate });
    const id = created.body.statement._id;

    const approved = await request(app).patch(`/api/vendors/statements/${id}/status`)
      .set(auth).send({ status: 'Approved' });
    expect(approved.status).toBe(200);

    const paid = await request(app).patch(`/api/vendors/statements/${id}/status`)
      .set(auth)
      .send({
        status: 'Paid',
        paymentMethod: 'Bank',
        paymentReference: 'BANK-001',
        receiverName: 'Rahim',
        paidAt: '2026-08-20T10:00:00.000Z',
      });
    expect(paid.status).toBe(200);
    expect(paid.body.statement).toMatchObject({
      status: 'Paid',
      paymentMethod: 'Bank',
      paymentReference: 'BANK-001',
        receiverName: 'Rahim',
      receivedBy: userId.toString(),
      receiverName: 'Rahim',
      settlementRef: created.body.statement.statementNumber,
      approvedBy: userId.toString(),
    });

    const locked = await request(app).patch(`/api/vendors/statements/${id}/status`)
      .set(auth).send({ status: 'Approved' });
    expect(locked.status).toBe(409);
    expect(locked.body.message).toMatch(/locked/i);
    expect(statementStore[0].status).toBe('Paid');
    expect(models.GoodsReceive.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ vendorId }),
      { $set: { settlementRef: created.body.statement.statementNumber } },
    );
  });

  async function approvedStatement() {
    const created = await request(app)
      .post(`/api/vendors/${vendorId}/statements`).set(auth).send({ startDate, endDate });
    const id = created.body.statement._id;
    await request(app).patch(`/api/vendors/statements/${id}/status`)
      .set(auth).send({ status: 'Approved' });
    return id;
  }

  it('refuses wallet payout while vendorWalletPayoutEnabled is false', async () => {
    const id = await approvedStatement();
    const response = await request(app).patch(`/api/vendors/statements/${id}/status`)
      .set(auth).send({
        status: 'Paid', paymentMethod: 'Wallet', paymentReference: 'W-1',
        paidAt: '2026-08-20T10:00:00.000Z', receiverName: 'Rahim',
      });
    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/wallet payout is disabled/i);
    expect(statementStore[0].status).toBe('Approved');
  });

  it('requires a receiver for direct payment', async () => {
    const id = await approvedStatement();
    const response = await request(app).patch(`/api/vendors/statements/${id}/status`)
      .set(auth).send({
        status: 'Paid', paymentMethod: 'Cash', paymentReference: 'C-1',
        paidAt: '2026-08-20T10:00:00.000Z',
      });
    expect(response.status).toBe(400);
    expect(statementStore[0].status).toBe('Approved');
  });

  it('blocks paying a draft statement', async () => {
    const created = await request(app)
      .post(`/api/vendors/${vendorId}/statements`).set(auth).send({ startDate, endDate });
    const response = await request(app)
      .patch(`/api/vendors/statements/${created.body.statement._id}/status`)
      .set(auth).send({
        status: 'Paid', paymentMethod: 'Cash', paymentReference: 'C-1',
        paidAt: '2026-08-20T10:00:00.000Z', receiverName: 'Rahim',
      });
    expect(response.status).toBe(409);
  });

  it('denies approval and payout history without vendor-payouts permissions', async () => {
    const id = await approvedStatement();
    permissions.splice(2);
    const approve = await request(app).patch(`/api/vendors/statements/${id}/status`)
      .set(auth).send({ status: 'Approved' });
    const history = await request(app).get('/api/vendors/payouts').set(auth);
    expect(approve.status).toBe(403);
    expect(history.status).toBe(403);
  });

  it('lists paid statements as payout history', async () => {
    const id = await approvedStatement();
    await request(app).patch(`/api/vendors/statements/${id}/status`).set(auth).send({
      status: 'Paid', paymentMethod: 'bKash', paymentReference: 'BK-1',
      paidAt: '2026-08-20T10:00:00.000Z', receiverName: 'Rahim',
    });
    models.VendorStatement.find.mockImplementation((filter) => query(
      statementStore.filter((item) => item.status === filter.status),
    ));
    const response = await request(app).get(`/api/vendors/payouts?vendorId=${vendorId}`).set(auth);
    expect(response.status).toBe(200);
    expect(response.body.payouts).toHaveLength(1);
    expect(response.body.payouts[0]).toMatchObject({ paymentMethod: 'bKash', receiverName: 'Rahim' });
  });
});
