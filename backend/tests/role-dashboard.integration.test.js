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
    find: jest.fn((filter = {}) => list(global.__db[name].filter((doc) => !filter.type || doc.type === filter.type))),
    findOne: jest.fn(() => ({ lean: async () => global.__db[name][0] || null })),
  });
  return {
    AuditLog: collection('AuditLog'),
    User: { findById: jest.fn() },
    Order: collection('Order'),
    Product: collection('Product'),
    StockMovement: collection('StockMovement'),
    VendorLedger: collection('VendorLedger'),
    VendorStatement: collection('VendorStatement'),
    Expense: collection('Expense'),
    GoodsReceive: collection('GoodsReceive'),
    StockAdjustment: collection('StockAdjustment'),
    Settings: collection('Settings'),
    Shift: collection('Shift'),
  };
});

const models = require('../models');
const dashboardRoutes = require('../routes/dashboardRoutes');
const errorMiddleware = require('../middlewares/errorMiddleware');

const secret = 'role-dashboard-secret';
const id = () => new mongoose.Types.ObjectId();
const me = id();
const other = id();
const p1 = id(); const p2 = id();
const today = new Date();
const order = (cashier, grandTotal, payments, number) => ({
  _id: id(), orderNumber: number, cashier, grandTotal, payments, paymentStatus: 'PAID',
  soldAt: today, lines: [{}], outlet: id(),
});

function seed() {
  global.__db = {
    Order: [
      order(me, 100.1, [{ method: 'CASH', amount: 100.1 }], 'B1'),
      order(me, 200.2, [{ method: 'BKASH', amount: 100.1 }, { method: 'CARD', amount: 100.1 }], 'B2'),
      order(other, 5000, [{ method: 'CASH', amount: 5000 }], 'OTHER'),
    ],
    Settings: [{ dailySalesTarget: 1000 }],
    Shift: [{ openedAt: new Date(today.getTime() - 3600000), openingCash: 500 }],
    Product: [{ _id: p1, name: 'Rice', barcode: '1' }, { _id: p2, name: 'Oil', barcode: '2' }],
    StockMovement: [
      { productId: p1, quantity: 6, type: 'GRN' }, { productId: p1, quantity: -3, type: 'SALE', createdAt: today },
      { productId: p2, quantity: 4, type: 'GRN' }, { productId: p2, quantity: -4, type: 'SALE', createdAt: today },
    ],
    GoodsReceive: [{ _id: id(), status: 'Draft', ownerType: 'COMPANY', lines: [{}], createdAt: today }],
    StockAdjustment: [{ _id: id(), status: 'Pending', reason: 'Damage', lines: [{}], createdAt: today }],
    VendorLedger: [{ companyNet: 10 }],
    VendorStatement: [{ status: 'Approved', netPayable: 50 }],
    Expense: [],
    AuditLog: [],
  };
}

describe('role-specific dashboards', () => {
  const app = express();
  app.use('/api/dashboard', dashboardRoutes);
  app.use(errorMiddleware);
  let role;
  const auth = () => ({ Authorization: `Bearer ${jwt.sign({ sub: me.toString() }, secret)}` });
  const get = async () => (await request(app).get('/api/dashboard').set(auth())).body.dashboard;

  beforeEach(() => {
    seed();
    process.env.JWT_SECRET = secret;
    models.User.findById.mockImplementation(() => ({
      populate: jest.fn(async () => ({
        _id: me, isActive: true, roleId: { _id: id(), name: role.name, permissions: role.permissions },
      })),
    }));
  });

  it('cashier sees only their own progress', async () => {
    role = { name: 'Outlet Cashier', permissions: ['dashboard:read'] };
    const d = await get();
    expect(d.view).toBe('cashier');
    expect(d.todaySales).toBe(300.3);
    expect(d.todayBillCount).toBe(2);
    expect(d.targetProgressPercent).toBe(30);
    expect(d.paymentSplit).toEqual({ cash: 100.1, bkash: 100.1, card: 100.1, other: 0 });
    expect(d.shift.expectedCash).toBe(600.1);
    expect(d.recentBills.map((bill) => bill.orderNumber).sort()).toEqual(['B1', 'B2']);
    ['totalSales', 'marginIncome', 'vendorPayablesDue', 'lowStockAlerts'].forEach((key) => expect(d).not.toHaveProperty(key));
  });

  it('inventory manager sees stock progress and no finance data', async () => {
    role = { name: 'Inventory Manager', permissions: ['dashboard:read'] };
    const d = await get();
    expect(d.view).toBe('inventory');
    expect(d.lowStockCount).toBe(1);
    expect(d.stockOutCount).toBe(1);
    expect(d.pendingGrnCount).toBe(1);
    expect(d.fastMoving[0]).toEqual(expect.objectContaining({ productName: 'Oil', soldQuantity: 4 }));
    expect(d.reorderRecommendations.find((r) => r.productName === 'Oil').suggestedQuantity).toBe(20);
    expect(d.recentAdjustments).toHaveLength(1);
    ['totalSales', 'marginIncome', 'vendorPayablesDue', 'todaySales'].forEach((key) => expect(d).not.toHaveProperty(key));
  });

  it('super admin keeps the full enterprise dashboard', async () => {
    role = { name: 'Super Admin', permissions: ['*'] };
    const d = await get();
    expect(d.view).toBe('admin');
    expect(d.totalSales).toBe(5300.3);
    expect(d.marginIncome).toBe(10);
    expect(d.vendorPayablesDue).toBe(50);
  });

  it('other roles get no business data', async () => {
    role = { name: 'Finance', permissions: ['dashboard:read'] };
    expect(await get()).toEqual({ view: 'general', generatedAt: expect.any(String) });
  });
});
