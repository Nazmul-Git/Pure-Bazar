const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');

jest.mock('../models', () => {
  const collection = (name) => ({
    find: jest.fn((filter = {}) => {
      const rows = global.__db[name].filter((doc) => {
        if (!filter.status) return true;
        return filter.status.$in ? filter.status.$in.includes(doc.status) : doc.status === filter.status;
      });
      const promise = Promise.resolve(rows);
      promise.select = () => promise;
      promise.lean = () => Promise.resolve(rows);
      return promise;
    }),
  });
  return {
    User: { findById: jest.fn() },
    StockCount: collection('StockCount'),
    StockAdjustment: collection('StockAdjustment'),
    StockTransfer: collection('StockTransfer'),
    GoodsReceive: collection('GoodsReceive'),
    StockMovement: collection('StockMovement'),
    Product: collection('Product'),
    Order: collection('Order'),
    VendorLedger: collection('VendorLedger'),
    VendorStatement: collection('VendorStatement'),
    Expense: collection('Expense'),
    AuditLog: collection('AuditLog'),
    Settings: collection('Settings'),
    Shift: collection('Shift'),
    WalletReconciliation: collection('WalletReconciliation'),
    SalarySheet: collection('SalarySheet'),
    SalaryAdvance: collection('SalaryAdvance'),
  };
});

const models = require('../models');
const notificationRoutes = require('../routes/notificationRoutes');
const errorMiddleware = require('../middlewares/errorMiddleware');

const secret = 'notification-secret';
const id = () => new mongoose.Types.ObjectId();
const me = id();
const p1 = id();

describe('GET /api/notifications', () => {
  const app = express();
  app.use('/api/notifications', notificationRoutes);
  app.use(errorMiddleware);
  let permissions;
  const get = () => request(app).get('/api/notifications')
    .set({ Authorization: `Bearer ${jwt.sign({ sub: me.toString() }, secret)}` });

  beforeEach(() => {
    process.env.JWT_SECRET = secret;
    global.__db = {
      StockCount: [{ _id: id(), status: 'PendingApproval' }, { _id: id(), status: 'Posted' }],
      StockAdjustment: [{ _id: id(), status: 'Pending', reason: 'Damage' }, { _id: id(), status: 'Approved' }],
      StockTransfer: [{ _id: id(), status: 'Requested' }, { _id: id(), status: 'Dispatched' }, { _id: id(), status: 'Received' }],
      GoodsReceive: [{ _id: id(), status: 'Draft' }],
      VendorStatement: [{ _id: id(), status: 'Draft', statementNumber: 'VS-1' }, { _id: id(), status: 'Approved' }, { _id: id(), status: 'Paid' }],
      WalletReconciliation: [{ _id: id(), status: 'Mismatch' }, { _id: id(), status: 'Matched' }],
      SalarySheet: [{ _id: id(), status: 'Draft', month: '2026-10' }],
      SalaryAdvance: [{ _id: id(), status: 'Draft' }, { _id: id(), status: 'Paid' }],
      Product: [{ _id: p1, name: 'Rice', barcode: '1' }],
      StockMovement: [{ productId: p1, quantity: 2 }],
    };
    models.User.findById.mockImplementation(() => ({
      populate: jest.fn(async () => ({ _id: me, isActive: true, roleId: { _id: id(), name: 'Manager', permissions } })),
    }));
  });

  it('aggregates every pending approval with a deep link', async () => {
    permissions = ['stock:read', 'stock:transfer:read', 'vendor-payouts:read', 'finance:read', 'payroll:read', 'salary-advances:read'];
    const { body } = await get().expect(200);
    const byKey = Object.fromEntries(body.notifications.groups.map((g) => [g.key, g]));
    expect(body.notifications.total).toBe(11);
    expect(byKey['stock-counts']).toEqual(expect.objectContaining({ count: 1, href: '/inventory/stock-counts' }));
    expect(byKey['stock-adjustments'].count).toBe(1);
    expect(byKey.transfers).toEqual(expect.objectContaining({ count: 2, href: '/inventory/transfers' }));
    expect(byKey['goods-receives'].count).toBe(1);
    expect(byKey['low-stock'].items[0].title).toContain('Rice');
    expect(byKey['vendor-payouts']).toEqual(expect.objectContaining({ count: 1, href: '/vendors/payouts' }));
    expect(byKey['payout-approvals'].href).toBe('/finance/batch-payout');
    expect(byKey['wallet-reconciliation'].href).toBe('/finance/wallet-reconciliation');
    expect(byKey['salary-sheets']).toEqual(expect.objectContaining({ count: 1, href: '/payroll/salary-sheets' }));
    expect(byKey['salary-advances']).toEqual(expect.objectContaining({ count: 1, href: '/payroll/advances' }));
  });

  it('hides groups the user has no permission for', async () => {
    permissions = ['stock:transfer:read'];
    const { body } = await get().expect(200);
    expect(body.notifications.groups.map((g) => g.key)).toEqual(['transfers']);
  });

  it('is empty when nothing is pending', async () => {
    permissions = ['*'];
    global.__db = { StockCount: [], StockAdjustment: [], StockTransfer: [], GoodsReceive: [], VendorStatement: [], WalletReconciliation: [], SalarySheet: [], SalaryAdvance: [], Product: [], StockMovement: [] };
    const { body } = await get().expect(200);
    expect(body.notifications).toEqual({ total: 0, groups: [] });
  });
});
