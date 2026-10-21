const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');

jest.mock('../models', () => ({
  AuditLog: { create: jest.fn() },
  Category: { find: jest.fn() },
  Expense: { create: jest.fn(), find: jest.fn(), findById: jest.fn() },
  ExpenseCategory: { findById: jest.fn(), find: jest.fn(), create: jest.fn() },
  Location: { findById: jest.fn() },
  Order: { find: jest.fn() },
  Product: { find: jest.fn() },
  SalarySheet: { findOne: jest.fn() },
  User: { findById: jest.fn() },
  VendorLedger: { find: jest.fn() },
  VendorStatement: { find: jest.fn() },
}));

const models = require('../models');
const financeRoutes = require('../routes/financeRoutes');
const errorMiddleware = require('../middlewares/errorMiddleware');
const { calculateBill } = require('../services/billEngine');

const secret = 'finance-api-test-secret';
const id = (n) => new mongoose.Types.ObjectId(`65c${String(n).padStart(21, '0')}`);
const userId = id(1);
const catA = id(2);
const catB = id(3);
const prodA = id(4);
const prodB = id(5);
const vendorId = id(6);
const expCat = id(7);
const loc = id(8);
const expenseId = id(9);

function query(value) {
  const chain = {
    populate: jest.fn(() => chain), select: jest.fn(() => chain), sort: jest.fn(() => chain),
    lean: jest.fn(async () => value),
  };
  return chain;
}

function buildOrder(orderId, items) {
  const bill = calculateBill({
    items,
    paymentMethod: 'CASH',
    settings: { vatEnabled: true, defaultVatRate: 10 },
    billDiscount: { type: 'FIXED', value: 10, reason: 'bill promo' },
  });
  const order = {
    _id: orderId,
    lines: bill.ledgerLines.map((line) => ({
      productId: line.productId,
      subtotal: line.subtotal,
      itemDiscountAmount: line.itemDiscountAmount,
      billDiscountAmount: line.billDiscountAmount,
      shareholderDiscountAmount: line.shareholderDiscountAmount,
      vatAmount: line.vatAmount,
    })),
  };
  const ledger = bill.ledgerLines.map((line) => ({
    vendorId, orderId, productId: line.productId, entryType: 'SALE', quantity: line.quantity,
    vendorPayable: line.vendorPayable, companyNet: line.companyNet,
  }));
  return { bill, order, ledger };
}

describe('finance API', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/finance', financeRoutes);
  app.use(errorMiddleware);
  const auth = { Authorization: `Bearer ${jwt.sign({ sub: userId.toString() }, secret)}` };
  let permissions;
  let expense;

  beforeEach(() => {
    process.env.JWT_SECRET = secret;
    jest.clearAllMocks();
    permissions = ['finance:read', 'expenses:read', 'expenses:write', 'vendor-payouts:write'];
    models.User.findById.mockReturnValue({
      populate: jest.fn(async () => ({ _id: userId, isActive: true, roleId: { name: 'Finance', permissions } })),
    });
    models.AuditLog.create.mockResolvedValue({});
    models.SalarySheet.findOne.mockReturnValue(query(null));
    models.ExpenseCategory.findById.mockReturnValue(query({ _id: expCat, isActive: true }));
    models.Location.findById.mockReturnValue(query({ _id: loc }));
    expense = {
      _id: expenseId, categoryId: expCat, amount: 50, expenseDate: new Date('2026-09-10T00:00:00Z'),
      description: 'Rent', paymentMethod: 'Cash', sourceType: 'MANUAL',
      toObject() { return { amount: this.amount }; },
      save: jest.fn(async () => {}),
    };
    models.Expense.findById.mockResolvedValue(expense);
  });

  describe('revenue ledger', () => {
    const items = [
      {
        productId: prodA, vendorId, ownerType: 'VENDOR', quantity: 2, mrp: 100, vendorPrice: 70,
        vatApplicable: true, discount: { type: 'FIXED', value: 20, reason: 'promo' },
      },
      {
        productId: prodB, vendorId, ownerType: 'VENDOR', quantity: 1, mrp: 200, vendorPrice: 150, vatApplicable: true,
      },
    ];

    function mockSales() {
      const first = buildOrder(id(10), items);
      models.VendorLedger.find.mockReturnValue(query(first.ledger));
      models.Order.find.mockReturnValue(query([first.order]));
      models.Product.find.mockReturnValue(query([
        { _id: prodA, categoryId: catA }, { _id: prodB, categoryId: catB },
      ]));
      models.Category.find.mockReturnValue(query([
        { _id: catA, name: 'Snacks' }, { _id: catB, name: 'Drinks' },
      ]));
      return first;
    }

    it('shows VAT separately and never counts it as income', async () => {
      const { bill } = mockSales();
      const res = await request(app)
        .get('/api/finance/revenue-ledger?startDate=2026-09-01&endDate=2026-09-30').set(auth);

      expect(res.status).toBe(200);
      expect(bill.vatAmount).toBeGreaterThan(0);
      expect(res.body.totals.vat).toBe(bill.vatAmount);
      const margin = (200 - 140) + (200 - 150);
      expect(res.body.totals.income).toBe(margin - bill.otherDiscountAmount);
      expect(res.body.totals.income + res.body.totals.vat).not.toBe(res.body.totals.income);
      expect(res.body.categories.map((c) => c.category)).toEqual(['Drinks', 'Snacks']);
    });

    it('income equals margin minus discounts from the orders', async () => {
      const { bill, order } = mockSales();
      const res = await request(app)
        .get('/api/finance/revenue-ledger?startDate=2026-09-01&endDate=2026-09-30').set(auth);

      const subtotal = order.lines.reduce((sum, l) => sum + l.subtotal, 0);
      const discounts = order.lines.reduce(
        (sum, l) => sum + l.itemDiscountAmount + l.billDiscountAmount + l.shareholderDiscountAmount, 0,
      );
      const vendorCost = 2 * 70 + 150;
      expect(res.body.totals.sales).toBe(subtotal);
      expect(res.body.totals.discounts).toBeCloseTo(discounts, 2);
      expect(res.body.totals.income).toBeCloseTo(subtotal - vendorCost - discounts, 2);
      expect(res.body.totals.discounts).toBeCloseTo(bill.otherDiscountAmount, 2);
    });

    it('requires finance:read and valid dates', async () => {
      permissions = ['expenses:read'];
      const denied = await request(app)
        .get('/api/finance/revenue-ledger?startDate=2026-09-01&endDate=2026-09-30').set(auth);
      expect(denied.status).toBe(403);
      permissions = ['finance:read'];
      const bad = await request(app).get('/api/finance/revenue-ledger?startDate=x&endDate=y').set(auth);
      expect(bad.status).toBe(400);
    });
  });

  describe('expenses', () => {
    const payload = {
      categoryId: expCat.toString(), amount: 120.5, description: 'Electricity', paymentMethod: 'Bank',
      locationId: loc.toString(), expenseDate: '2026-09-15',
    };

    it('creates an audited expense with category, amount, date, location and method', async () => {
      models.Expense.create.mockImplementation(async (data) => ({ _id: expenseId, ...data, toObject: () => data }));
      const res = await request(app).post('/api/finance/expenses').set(auth).send(payload);

      expect(res.status).toBe(201);
      expect(models.Expense.create).toHaveBeenCalledWith(expect.objectContaining({
        amount: 120.5, paymentMethod: 'Bank', createdBy: userId,
      }));
      expect(models.AuditLog.create).toHaveBeenCalled();
    });

    it('rejects invalid expense input', async () => {
      const res = await request(app).post('/api/finance/expenses').set(auth)
        .send({ ...payload, amount: -5, paymentMethod: 'Gold' });
      expect(res.status).toBe(400);
    });

    it('blocks edits and new expenses in a closed month', async () => {
      models.SalarySheet.findOne.mockReturnValue(query({ _id: id(11), status: 'Paid', month: '2026-09' }));
      const edit = await request(app).patch(`/api/finance/expenses/${expenseId}`).set(auth).send({ amount: 99 });
      expect(edit.status).toBe(409);
      expect(expense.save).not.toHaveBeenCalled();
      const create = await request(app).post('/api/finance/expenses').set(auth).send(payload);
      expect(create.status).toBe(409);
      expect(models.Expense.create).not.toHaveBeenCalled();
    });

    it('edits an expense in an open month and blocks payroll expenses', async () => {
      const ok = await request(app).patch(`/api/finance/expenses/${expenseId}`).set(auth).send({ amount: 99 });
      expect(ok.status).toBe(200);
      expect(expense.amount).toBe(99);
      expect(expense.save).toHaveBeenCalled();

      expense.sourceType = 'SALARY_SHEET';
      const payroll = await request(app).patch(`/api/finance/expenses/${expenseId}`).set(auth).send({ amount: 1 });
      expect(payroll.status).toBe(409);
    });
  });

  describe('payout approval batch', () => {
    function statement(n, status) {
      const doc = {
        _id: id(20 + n), statementNumber: `VST-${n}`, status,
        toObject() { return { status: this.status }; },
        save: jest.fn(async () => {}),
      };
      return doc;
    }

    it('approves all draft statements and audits the batch', async () => {
      const docs = [statement(1, 'Draft'), statement(2, 'Draft')];
      models.VendorStatement.find.mockResolvedValue(docs);
      const res = await request(app).post('/api/finance/payout-batches').set(auth)
        .send({ statementIds: docs.map((d) => d._id.toString()) });

      expect(res.status).toBe(200);
      expect(res.body.approved).toBe(2);
      docs.forEach((d) => {
        expect(d.status).toBe('Approved');
        expect(d.approvedBy).toBe(userId);
      });
      expect(models.AuditLog.create).toHaveBeenCalledTimes(3);
    });

    it('approves nothing when any statement is not a draft', async () => {
      const docs = [statement(1, 'Draft'), statement(2, 'Paid')];
      models.VendorStatement.find.mockResolvedValue(docs);
      const res = await request(app).post('/api/finance/payout-batches').set(auth)
        .send({ statementIds: docs.map((d) => d._id.toString()) });

      expect(res.status).toBe(409);
      expect(docs[0].save).not.toHaveBeenCalled();
    });

    it('requires vendor-payouts:write', async () => {
      permissions = ['finance:read'];
      const res = await request(app).post('/api/finance/payout-batches').set(auth)
        .send({ statementIds: [id(21).toString()] });
      expect(res.status).toBe(403);
    });
  });
});
