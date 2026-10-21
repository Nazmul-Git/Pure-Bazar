const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const ExcelJS = require('exceljs');

jest.mock('../models', () => {
  const list = (items) => {
    const promise = Promise.resolve(items);
    promise.select = () => promise;
    promise.lean = () => Promise.resolve(items);
    return promise;
  };
  const collection = (name) => ({
    find: jest.fn((filter = {}) => list(global.__db[name].filter((doc) => Object.entries(filter)
      .every(([key, value]) => doc[key] === value)))),
  });
  return {
    User: { findById: jest.fn() },
    Order: collection('Order'),
    Product: collection('Product'),
    StockMovement: collection('StockMovement'),
    VendorLedger: collection('VendorLedger'),
    Vendor: collection('Vendor'),
    Expense: collection('Expense'),
    ExpenseCategory: collection('ExpenseCategory'),
    DiscountLog: collection('DiscountLog'),
  };
});

const models = require('../models');
const reportRoutes = require('../routes/reportRoutes');
const errorMiddleware = require('../middlewares/errorMiddleware');
const { salesReport, stockReport } = require('../services/salesStockReportService');
const { vendorProfitability, profitLoss, vatDiscountReport } = require('../services/financeReportService');

const secret = 'reports-test-secret';
const userId = new mongoose.Types.ObjectId('65d000000000000000000001');
const id = () => new mongoose.Types.ObjectId();
const at = (iso) => new Date(iso);
const sum = (items, pick) => items.reduce((total, item) => total + Math.round(pick(item) * 100), 0) / 100;

const pV = id(); const pC = id(); const v1 = id(); const v2 = id(); const cat = id();
const o1 = id(); const o2 = id(); const o3 = id(); const o4 = id();

function seed() {
  global.__db = {
    Product: [
      { _id: pV, name: 'Vendor Rice', barcode: '1', vendorPrice: 75 },
      { _id: pC, name: 'Own Soap', barcode: '2', vendorPrice: 30 },
    ],
    Vendor: [{ _id: v1, name: 'Karim', shopName: 'K Store', memberId: 'V1' }, { _id: v2, name: 'Rahim', shopName: 'R Store', memberId: 'V2' }],
    Order: [
      {
        _id: o1, paymentStatus: 'PAID', soldAt: at('2026-03-10T10:00:00+06:00'), subtotal: 250, otherDiscountAmount: 15,
        shareholderDiscountAmount: 0, vatAmount: 7.5, grandTotal: 242.5,
        lines: [
          { productId: pV, quantity: 2, subtotal: 200, itemDiscountAmount: 10, billDiscountAmount: 0 },
          { productId: pC, quantity: 1, subtotal: 50, itemDiscountAmount: 0, billDiscountAmount: 5 },
        ],
      },
      {
        _id: o2, paymentStatus: 'PAID', soldAt: at('2026-03-11T00:30:00+06:00'), subtotal: 100, otherDiscountAmount: 0,
        shareholderDiscountAmount: 5, vatAmount: 0.1, grandTotal: 95.1,
        lines: [{ productId: pV, quantity: 1, subtotal: 100, itemDiscountAmount: 0, billDiscountAmount: 0, shareholderDiscountAmount: 5 }],
      },
      {
        _id: o3, paymentStatus: 'REFUNDED', soldAt: at('2026-03-11T12:00:00+06:00'), subtotal: 100, otherDiscountAmount: 0,
        shareholderDiscountAmount: 0, vatAmount: 3, grandTotal: 103,
        lines: [{ productId: pV, quantity: 1, subtotal: 100, itemDiscountAmount: 0, billDiscountAmount: 0 }],
      },
      {
        _id: o4, paymentStatus: 'PAID', soldAt: at('2026-04-02T12:00:00+06:00'), subtotal: 50, otherDiscountAmount: 0,
        shareholderDiscountAmount: 0, vatAmount: 0, grandTotal: 50,
        lines: [{ productId: pC, quantity: 1, subtotal: 50, itemDiscountAmount: 0, billDiscountAmount: 0 }],
      },
    ],
    VendorLedger: [
      { vendorId: v1, orderId: o1, productId: pV, quantity: 2, entryType: 'SALE', vendorPayable: 150, companyNet: 40, createdAt: at('2026-03-10T10:00:00+06:00') },
      { vendorId: v2, orderId: o2, productId: pV, quantity: 1, entryType: 'SALE', vendorPayable: 75, companyNet: 20, createdAt: at('2026-03-11T00:30:00+06:00') },
      { vendorId: v1, orderId: o3, productId: pV, quantity: 1, entryType: 'SALE', vendorPayable: 75, companyNet: 25, createdAt: at('2026-03-11T12:00:00+06:00') },
      { vendorId: v1, orderId: o3, productId: pV, quantity: 1, entryType: 'RETURN', vendorPayable: 75, companyNet: -25, createdAt: at('2026-03-11T13:00:00+06:00') },
    ],
    ExpenseCategory: [{ _id: cat, name: 'Rent' }],
    Expense: [
      { categoryId: cat, amount: 12.34, expenseDate: at('2026-03-10T09:00:00+06:00') },
      { categoryId: cat, amount: 500, expenseDate: at('2026-02-28T09:00:00+06:00') },
    ],
    DiscountLog: [
      { orderId: o1, scope: 'ITEM' }, { orderId: o1, scope: 'BILL' }, { orderId: o3, scope: 'BILL' },
    ],
    StockMovement: [
      { productId: pV, type: 'GRN', quantity: 20, createdAt: at('2026-03-01T10:00:00+06:00') },
      { productId: pV, type: 'SALE', quantity: -2, createdAt: at('2026-03-10T10:00:00+06:00') },
      { productId: pV, type: 'SALE', quantity: -1, createdAt: at('2026-03-11T00:30:00+06:00') },
      { productId: pV, type: 'RETURN', quantity: 1, createdAt: at('2026-03-11T13:00:00+06:00') },
      { productId: pC, type: 'GRN', quantity: 8, createdAt: at('2026-03-01T10:00:00+06:00') },
      { productId: pC, type: 'SALE', quantity: -1, createdAt: at('2026-03-10T10:00:00+06:00') },
    ],
  };
}

describe('reports API', () => {
  beforeEach(seed);

  it('sales report totals equal raw paid orders, by day and month', async () => {
    const paid = global.__db.Order.filter((o) => o.paymentStatus === 'PAID');
    const march = paid.filter((o) => o.soldAt < at('2026-04-01T00:00:00+06:00'));
    const daily = await salesReport({ from: '2026-03-01', to: '2026-03-31' });
    expect(daily.rows.map((r) => r.period)).toEqual(['2026-03-10', '2026-03-11']);
    expect(daily.totals.totalSales).toBe(sum(march, (o) => o.grandTotal));
    expect(daily.totals.totalSales).toBe(337.6);
    expect(daily.totals.vat).toBe(7.6);
    expect(daily.totals.discounts).toBe(20);
    expect(daily.totals.billCount).toBe(2);
    expect(sum(daily.rows, (r) => r.totalSales)).toBe(daily.totals.totalSales);

    const monthly = await salesReport({ groupBy: 'month' });
    expect(monthly.rows.map((r) => [r.period, r.totalSales])).toEqual([['2026-03', 337.6], ['2026-04', 50]]);
    expect(monthly.totals.totalSales).toBe(sum(paid, (o) => o.grandTotal));
  });

  it('stock report matches movements, turnover and low stock', async () => {
    const report = await stockReport({ from: '2026-03-10', to: '2026-03-31', lowStockThreshold: 10 });
    const rice = report.rows.find((r) => r.productName === 'Vendor Rice');
    const raw = global.__db.StockMovement.filter((m) => m.productId === pV);
    expect(rice.opening).toBe(20);
    expect(rice.sold).toBe(2);
    expect(rice.closing).toBe(18);
    expect(rice.onHand).toBe(raw.reduce((t, m) => t + m.quantity, 0));
    expect(rice.turnover).toBe(0.1053);
    expect(report.lowStock.map((r) => [r.productName, r.quantity])).toEqual([['Own Soap', 7]]);
  });

  it('vendor profitability per vendor sums to the ledger', async () => {
    const report = await vendorProfitability({ from: '2026-03-01', to: '2026-03-31' });
    expect(report.rows.map((r) => [r.vendorName, r.vendorPayable, r.companyNet])).toEqual([
      ['Karim', 150, 40], ['Rahim', 75, 20],
    ]);
    expect(report.totals.companyNet).toBe(sum(global.__db.VendorLedger, (l) => l.companyNet));
    expect(report.totals.companyNet).toBe(60);
    expect(report.totals.vendorPayable).toBe(225);
  });

  it('profit/loss = margin income + own margin - discounts - expenses', async () => {
    const report = await profitLoss({ from: '2026-03-01', to: '2026-03-31' });
    expect(report.marginIncome).toBe(75);
    expect(report.ownStockMargin).toBe(20);
    expect(report.discounts).toBe(20);
    expect(report.expenses).toBe(12.34);
    expect(report.netProfit).toBe(62.66);
    expect(report.expensesByCategory).toEqual([{ categoryId: String(cat), category: 'Rent', total: 12.34 }]);
    // Cross-check against ledger companyNet (already net of vendor-line discounts) plus own-line net.
    const paidLedger = global.__db.VendorLedger.filter((l) => [o1, o2].includes(l.orderId));
    expect(report.netProfit + report.expenses).toBe(sum(paidLedger, (l) => l.companyNet) + (50 - 30 - 5));
  });

  it('VAT and discount report matches paid orders', async () => {
    const report = await vatDiscountReport({ from: '2026-03-01', to: '2026-03-31' });
    expect(report.totals.vat).toBe(7.6);
    expect(report.totals.itemDiscount).toBe(10);
    expect(report.totals.billDiscount).toBe(5);
    expect(report.totals.shareholderDiscount).toBe(5);
    expect(report.totals.totalDiscount).toBe(20);
    expect(report.discountEntries).toEqual({ item: 1, bill: 1 });
    expect(report.rows.map((r) => r.period)).toEqual(['2026-03-10', '2026-03-11']);
  });

  describe('routes', () => {
    const app = express();
    app.use('/api/reports', reportRoutes);
    app.use(errorMiddleware);
    let permissions;
    const auth = () => ({ Authorization: `Bearer ${jwt.sign({ sub: userId.toString() }, secret)}` });
    const binary = (res, cb) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    };

    beforeEach(() => {
      process.env.JWT_SECRET = secret;
      permissions = ['reports:read'];
      models.User.findById.mockImplementation(() => ({
        populate: jest.fn(async () => ({
          _id: userId, isActive: true, roleId: { _id: userId, name: 'Role', permissions },
        })),
      }));
    });

    it('enforces permissions and validates input', async () => {
      expect((await request(app).get('/api/reports/sales')).status).toBe(401);
      permissions = ['reports:sales-stock:read'];
      expect((await request(app).get('/api/reports/stock').set(auth())).status).toBe(200);
      expect((await request(app).get('/api/reports/profit-loss').set(auth())).status).toBe(403);
      permissions = [];
      expect((await request(app).get('/api/reports/sales').set(auth())).status).toBe(403);
      permissions = ['reports:read'];
      expect((await request(app).get('/api/reports/sales?from=bad').set(auth())).status).toBe(400);
      expect((await request(app).get('/api/reports/sales?from=2026-03-05&to=2026-03-01').set(auth())).status).toBe(400);
      expect((await request(app).get('/api/reports/sales?groupBy=year').set(auth())).status).toBe(400);
    });

    it('serves json, Excel and PDF with matching totals', async () => {
      const json = await request(app).get('/api/reports/profit-loss?from=2026-03-01&to=2026-03-31').set(auth());
      expect(json.body.report.netProfit).toBe(62.66);

      const xlsx = await request(app).get('/api/reports/vendor-profitability?format=xlsx&from=2026-03-01&to=2026-03-31')
        .set(auth()).buffer(true).parse(binary);
      expect(xlsx.headers['content-type']).toContain('spreadsheetml');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(xlsx.body);
      const sheet = workbook.worksheets[0];
      expect(sheet.getRow(2).getCell(1).value).toBe('Karim');
      expect(sheet.getRow(4).getCell(6).value).toBe(60);

      const pdf = await request(app).get('/api/reports/vendor-profitability?format=pdf').set(auth())
        .buffer(true).parse(binary);
      expect(pdf.headers['content-type']).toBe('application/pdf');
      expect(pdf.body.slice(0, 5).toString()).toBe('%PDF-');
    });

    it('exports sales, stock, profit/loss and VAT/discount reports', async () => {
      const sales = await request(app).get('/api/reports/sales?format=xlsx&from=2026-03-01&to=2026-03-31')
        .set(auth()).buffer(true).parse(binary);
      const salesWorkbook = new ExcelJS.Workbook();
      await salesWorkbook.xlsx.load(sales.body);
      expect(salesWorkbook.worksheets[0].getRow(4).getCell(6).value).toBe(337.6);

      const stock = await request(app).get('/api/reports/stock?format=pdf&from=2026-03-10&to=2026-03-31')
        .set(auth()).buffer(true).parse(binary);
      expect(stock.headers['content-type']).toBe('application/pdf');
      expect(stock.body.slice(0, 5).toString()).toBe('%PDF-');

      const profitLossXlsx = await request(app).get('/api/reports/profit-loss?format=xlsx&from=2026-03-01&to=2026-03-31')
        .set(auth()).buffer(true).parse(binary);
      const profitLossWorkbook = new ExcelJS.Workbook();
      await profitLossWorkbook.xlsx.load(profitLossXlsx.body);
      expect(profitLossWorkbook.worksheets[0].getRow(7).getCell(2).value).toBe(62.66);

      const vatDiscountPdf = await request(app).get('/api/reports/vat-discount?format=pdf&from=2026-03-01&to=2026-03-31')
        .set(auth()).buffer(true).parse(binary);
      expect(vatDiscountPdf.headers['content-type']).toBe('application/pdf');
      expect(vatDiscountPdf.body.slice(0, 5).toString()).toBe('%PDF-');
    });
  });
});
