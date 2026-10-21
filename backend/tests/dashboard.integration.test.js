const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');

jest.mock('../models', () => {
  const list = (items) => {
    const promise = Promise.resolve(items);
    promise.sort = () => promise;
    promise.select = () => promise;
    promise.lean = () => Promise.resolve(items);
    return promise;
  };
  const collection = (name) => ({
    find: jest.fn((filter = {}) => list(global.__db[name].filter((doc) => Object.entries(filter)
      .every(([key, value]) => doc[key] === value)))),
  });
  return {
    AuditLog: { ...collection('AuditLog'), create: jest.fn() },
    User: { findById: jest.fn() },
    Order: collection('Order'),
    Product: collection('Product'),
    StockMovement: collection('StockMovement'),
    VendorLedger: collection('VendorLedger'),
    VendorStatement: collection('VendorStatement'),
    Expense: collection('Expense'),
  };
});

const models = require('../models');
const dashboardRoutes = require('../routes/dashboardRoutes');
const errorMiddleware = require('../middlewares/errorMiddleware');
const { getDashboard } = require('../services/dashboardService');

const secret = 'dashboard-test-secret';
const userId = new mongoose.Types.ObjectId('65d000000000000000000001');
const id = () => new mongoose.Types.ObjectId();
const now = new Date('2026-03-10T15:00:00+06:00');
const at = (iso) => new Date(iso);

const p1 = id(); const p2 = id(); const p3 = id(); const ghost = id();
const order = (grandTotal, payments, soldAt, paymentStatus = 'PAID') => ({
  _id: id(), grandTotal, payments, soldAt: at(soldAt), paymentStatus,
});

function seed() {
  global.__db = {
    Product: [
      { _id: p1, name: 'Rice', barcode: '1' }, { _id: p2, name: 'Oil', barcode: '2' },
      { _id: p3, name: 'Salt', barcode: '3' },
    ],
    Order: [
      order(100.10, [{ method: 'CASH', amount: 100.10 }], '2026-03-10T00:30:00+06:00'),
      order(200.20, [{ method: 'WALLET', amount: 150.15 }, { method: 'BKASH', amount: 50.05 }], '2026-03-10T11:00:00+06:00'),
      order(0.10, [{ method: 'CASH', amount: 0.10 }], '2026-03-10T23:59:00+06:00'),
      order(300.30, [{ method: 'CASH', amount: 300.30 }], '2026-03-09T23:59:00+06:00'),
      order(999, [{ method: 'CASH', amount: 999 }], '2026-03-10T10:00:00+06:00', 'REFUNDED'),
    ],
    VendorLedger: [{ companyNet: 10.1 }, { companyNet: 20.2 }, { companyNet: -5.05 }],
    VendorStatement: [
      { status: 'Approved', netPayable: 500.55 }, { status: 'Approved', netPayable: 100.1 },
      { status: 'Paid', netPayable: 9999 }, { status: 'Draft', netPayable: 8888 },
    ],
    Expense: [
      { amount: 40.1, expenseDate: at('2026-03-01T00:30:00+06:00') },
      { amount: 60.2, expenseDate: at('2026-03-09T10:00:00+06:00') },
      { amount: 7777, expenseDate: at('2026-02-28T23:00:00+06:00') },
      { amount: 8888, expenseDate: at('2026-04-01T00:30:00+06:00') },
    ],
    StockMovement: [
      { productId: p1, quantity: 30 }, { productId: p1, quantity: -25 },
      { productId: p2, quantity: 50 }, { productId: p3, quantity: 10 },
      { productId: ghost, quantity: 1 },
    ],
    AuditLog: Array.from({ length: 12 }, (_, i) => ({
      _id: id(), action: `act${i}`, entity: 'Order', createdAt: new Date(Date.UTC(2026, 2, 10, 0, i)),
    })).reverse(),
  };
}

const sum = (items, pick) => items.reduce((total, item) => total + Math.round(pick(item) * 100), 0) / 100;

describe('dashboard API', () => {
  beforeEach(seed);

  it('every number equals a direct calculation over the stored data', async () => {
    const d = await getDashboard({ now });
    const paid = global.__db.Order.filter((o) => o.paymentStatus === 'PAID');
    const today = paid.filter((o) => o.soldAt >= at('2026-03-10T00:00:00+06:00')
      && o.soldAt < at('2026-03-11T00:00:00+06:00'));
    const todayPayments = today.flatMap((o) => o.payments);
    const method = (m) => sum(todayPayments.filter((p) => p.method === m), (p) => p.amount);

    expect(d.totalSales).toBe(sum(paid, (o) => o.grandTotal));
    expect(d.totalSales).toBe(600.7);
    expect(d.marginIncome).toBe(sum(global.__db.VendorLedger, (l) => l.companyNet));
    expect(d.marginIncome).toBe(25.25);
    expect(d.todaySales).toBe(sum(today, (o) => o.grandTotal));
    expect(d.todaySales).toBe(300.4);
    expect(d.todayBillCount).toBe(3);
    expect(d.todayByPaymentMethod).toEqual({ BKASH: method('BKASH'), CASH: method('CASH'), WALLET: method('WALLET') });
    expect(d.todayByPaymentMethod).toEqual({ BKASH: 50.05, CASH: 100.2, WALLET: 150.15 });
    expect(d.walletBillTotal).toBe(150.15);
    expect(d.vendorPayablesDue).toBe(sum(global.__db.VendorStatement.filter((s) => s.status === 'Approved'), (s) => s.netPayable));
    expect(d.vendorPayablesDue).toBe(600.65);
    expect(d.monthExpenses).toBe(sum(global.__db.Expense.slice(0, 2), (e) => e.amount));
    expect(d.monthExpenses).toBe(100.3);
  });

  it('lists low stock from movement totals and the latest 10 audit entries', async () => {
    const d = await getDashboard({ now });
    expect(d.lowStockAlerts.map((a) => [a.productName, a.quantity])).toEqual([['Rice', 5], ['Salt', 10]]);
    expect((await getDashboard({ now, lowStockThreshold: 4 })).lowStockAlerts).toEqual([]);
    expect(d.recentActivity).toHaveLength(10);
    expect(d.recentActivity[0].action).toBe('act11');
    expect(d.recentActivity[9].action).toBe('act2');
  });

  describe('route', () => {
    const app = express();
    app.use('/api/dashboard', dashboardRoutes);
    app.use(errorMiddleware);
    let permissions;
    const auth = () => ({ Authorization: `Bearer ${jwt.sign({ sub: userId.toString() }, secret)}` });

    beforeEach(() => {
      process.env.JWT_SECRET = secret;
      permissions = ['dashboard:read'];
      models.User.findById.mockImplementation(() => ({
        populate: jest.fn(async () => ({
          _id: userId, isActive: true, roleId: { _id: userId, name: 'Role', permissions },
        })),
      }));
    });

    it('requires dashboard:read', async () => {
      permissions = [];
      expect((await request(app).get('/api/dashboard').set(auth())).status).toBe(403);
      expect((await request(app).get('/api/dashboard')).status).toBe(401);
    });

    it('returns the dashboard and validates the threshold', async () => {
      const res = await request(app).get('/api/dashboard').set(auth());
      expect(res.status).toBe(200);
      expect(res.body.dashboard.totalSales).toBe(600.7);
      expect((await request(app).get('/api/dashboard?lowStockThreshold=-1').set(auth())).status).toBe(400);
    });
  });
});

