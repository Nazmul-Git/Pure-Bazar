/**
 * End-to-end month: real Express app + real Mongoose models on an in-memory
 * MongoDB replica set. Only the Probashi wallet service is stubbed.
 *
 * Manual calculation (BDT) the test asserts:
 *   Honey  (vendor product)  vendor price 60, MRP 100
 *   Rice   (company product) cost 40,         MRP 50
 *   Bill A cash   : 3 Honey + 2 Rice            = 300 + 100 = 400
 *   Bill B wallet : 2 Honey = 200, 5% shareholder discount 10 -> 190
 *   Bill C cash   : 1 Honey = 100, later returned (excluded from P&L)
 *   Vendor margin income = (300-180) + (200-120)         = 200
 *   Own-stock margin     = 100 - 2*40                    = 20
 *   Discounts            = 10
 *   Expenses             = 150 rent + 50 utilities       = 200
 *   Net profit           = 200 + 20 - 10 - 200           = 10
 *   Vendor statement     = (6 sold - 1 returned) * 60    = 300 payable
 *   Cashier expected cash = 500 opening + 400 cash sales = 900 (C refunded)
 */
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

jest.mock('../services/probashiWalletService', () => ({
  verifyMember: jest.fn(),
  checkWalletBalance: jest.fn(),
  getTransactionReport: jest.fn(),
}));

const probashi = require('../services/probashiWalletService');
const m = require('../models');
const app = require('../server');
const { dhakaDate } = require('../services/walletReconciliationService');

const secret = 'e2e-month-secret';
const ADMIN = ['*'];
const CASHIER = ['pos:read', 'pos:write', 'shifts:manage', 'stock:transfer:read', 'stock:transfer:receive'];

jest.setTimeout(120000);

describe('A full month of PureBazar operations', () => {
  let replSet;
  let admin;
  let cashier;
  let central;
  let outlet;
  const ids = {};
  const token = (user) => ({ Authorization: `Bearer ${jwt.sign({ sub: user._id.toString() }, secret)}` });
  const as = (user) => ({
    get: (url) => request(app).get(url).set(token(user)),
    post: (url, body) => request(app).post(url).set(token(user)).send(body),
    patch: (url, body) => request(app).patch(url).set(token(user)).send(body),
  });
  const stock = async (warehouseId, productId) => {
    const [row] = await m.StockMovement.aggregate([
      { $match: { warehouseId, productId: new mongoose.Types.ObjectId(productId) } },
      { $group: { _id: null, quantity: { $sum: '$quantity' } } },
    ]);
    return row?.quantity || 0;
  };
  const checkout = async (body, expectedTotal) => {
    const res = await as(cashier).post('/api/pos/checkout', body);
    expect(res.status).toBe(201);
    expect(res.body.order.grandTotal).toBe(expectedTotal);
    return res.body.order;
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = secret;
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
    await Promise.all(Object.values(m).filter((model) => model.init).map((model) => model.init()));

    const [adminRole, cashierRole] = await m.Role.create([
      { name: 'Super Admin', permissions: ADMIN },
      { name: 'Outlet Cashier', permissions: CASHIER },
    ]);
    central = await m.Location.create({ type: 'CENTRAL', name: 'Central Warehouse' });
    outlet = await m.Location.create({ type: 'OUTLET', name: 'Main Outlet', isPrimary: true });
    admin = await m.User.create({
      name: 'Admin', email: 'admin@pb.test', passwordHash: 'x', roleId: adminRole._id,
    });
    cashier = await m.User.create({
      name: 'Cashier', email: 'cashier@pb.test', passwordHash: 'x', roleId: cashierRole._id, locationId: outlet._id,
    });
    await m.Settings.create({ singleton: 'global', enabledPaymentMethods: ['Cash', 'Bank', 'bKash', 'Nagad', 'Wallet'] });
    ids.category = (await m.Category.create({ name: 'Grocery' }))._id.toString();
    ids.unit = (await m.Unit.create({ name: 'Piece', abbreviation: 'pc' }))._id.toString();
    ids.expenseCategories = (await m.ExpenseCategory.create([{ name: 'Rent' }, { name: 'Utilities' }]))
      .map((category) => category._id.toString());
    probashi.verifyMember.mockResolvedValue({
      valid: true, active: true, walletEnabled: true, memberId: 'M-100', name: 'Karim', mobile: '01700000001',
    });
    probashi.checkWalletBalance.mockResolvedValue({ sufficient: true });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await replSet.stop();
  });

  it('runs vendor -> stock -> sales -> return -> shift -> reconciliation -> settlement -> expenses -> P&L', async () => {
    // 1. Vendor and products
    let res = await as(admin).post('/api/vendors', {
      memberId: 'V-900', name: 'Rahim', mobile: '01800000009', shopName: 'Rahim Honey',
      nidOrPassportNumber: '1234567890', presentAddress: 'Dhaka', permanentAddress: 'Dhaka',
      tradeLicenseNumber: 'TL-1', address: 'Dhaka', productCategory: 'Grocery', payoutMethod: 'Bank',
      termsAccepted: true, termsVersion: 'v1',
    });
    expect(res.status).toBe(201);
    ids.vendor = res.body.vendor.id;

    res = await as(admin).post('/api/products', {
      name: 'Honey', categoryId: ids.category, unitId: ids.unit, ownerType: 'VENDOR',
      vendorId: ids.vendor, vendorPrice: 60, mrp: 100,
    });
    expect(res.status).toBe(201);
    ids.honey = (res.body.product.id || res.body.product._id);
    res = await as(admin).post('/api/products', {
      name: 'Rice', categoryId: ids.category, unitId: ids.unit, ownerType: 'COMPANY', vendorPrice: 40, mrp: 50,
    });
    expect(res.status).toBe(201);
    ids.rice = (res.body.product.id || res.body.product._id);

    // 2. Goods receive notes (2 honey rejected on arrival)
    const receive = async (body) => {
      const created = await as(admin).post('/api/goods-receives', { warehouseId: central._id.toString(), ...body });
      expect(created.status).toBe(201);
      const approved = await as(admin).post(`/api/goods-receives/${created.body.goodsReceive.id}/approve`, {});
      expect(approved.status).toBe(200);
    };
    await receive({
      ownerType: 'VENDOR', vendorId: ids.vendor, vendorChallanNumber: 'CHN-1',
      lines: [{ productId: ids.honey, receivedQuantity: 100, acceptedQuantity: 98, rejectedQuantity: 2 }],
    });
    await receive({
      ownerType: 'COMPANY',
      lines: [{ productId: ids.rice, receivedQuantity: 50, acceptedQuantity: 50, rejectedQuantity: 0 }],
    });
    expect(await stock(central._id, ids.honey)).toBe(98);
    expect(await stock(central._id, ids.rice)).toBe(50);

    // 3. Transfer to the outlet
    res = await as(admin).post('/api/stock-transfers', {
      fromWarehouseId: central._id.toString(), toWarehouseId: outlet._id.toString(),
      lines: [{ productId: ids.honey, requestedQuantity: 40 }, { productId: ids.rice, requestedQuantity: 20 }],
    });
    expect(res.status).toBe(201);
    const transferId = res.body.stockTransfer.id;
    const quantities = { [ids.honey]: 40, [ids.rice]: 20 };
    res = await as(admin).post(`/api/stock-transfers/${transferId}/dispatch`, {
      lines: Object.entries(quantities).map(([productId, dispatchedQuantity]) => ({ productId, dispatchedQuantity })),
    });
    expect(res.status).toBe(200);
    res = await as(cashier).post(`/api/stock-transfers/${transferId}/receive`, {
      lines: Object.entries(quantities).map(([productId, receivedQuantity]) => ({ productId, receivedQuantity })),
    });
    expect(res.status).toBe(200);
    expect(await stock(outlet._id, ids.honey)).toBe(40);
    expect(await stock(central._id, ids.honey)).toBe(58);

    // 4. Shift, cash bill, wallet bill, returned cash bill
    res = await as(cashier).post('/api/pos/shifts', { openingCash: 500 });
    expect(res.status).toBe(201);
    const shiftId = res.body.shift._id;

    const billA = await checkout({
      items: [{ productId: ids.honey, quantity: 3 }, { productId: ids.rice, quantity: 2 }],
      payments: [{ method: 'CASH', amount: 400 }],
    }, 400);
    res = await as(cashier).post('/api/pos/verify-member', { memberId: 'M-100' });
    expect(res.status).toBe(200);
    const shareholder = await m.Shareholder.findOne({ memberId: 'M-100' });
    const billB = await checkout({
      items: [{ productId: ids.honey, quantity: 2 }],
      payments: [{ method: 'WALLET', amount: 190 }],
      shareholderId: shareholder._id.toString(),
    }, 190);
    expect(billB.shareholderDiscountAmount).toBe(10);
    const billC = await checkout({
      items: [{ productId: ids.honey, quantity: 1 }],
      payments: [{ method: 'CASH', amount: 100 }],
    }, 100);
    expect(await stock(outlet._id, ids.honey)).toBe(34);

    res = await as(cashier).post(`/api/pos/${billC._id}/return`, {});
        expect(res.status).toBe(200);
    expect(res.body.return.refundAmount).toBe(100);
    expect(await stock(outlet._id, ids.honey)).toBe(35);
    expect(await stock(outlet._id, ids.rice)).toBe(18);

    // 5. Shift close: expected 500 + 400, counted 895 -> short by 5
    res = await as(cashier).post(`/api/pos/shifts/${shiftId}/close`, { actualCash: 895 });
    expect(res.status).toBe(200);
    expect(res.body.shift.expectedCash).toBe(900);
    expect(res.body.shift.cashDifference).toBe(-5);

    // 6. Wallet reconciliation against the Probashi report
    probashi.getTransactionReport.mockResolvedValue({
      memberId: 'M-100', transactions: [{ transactionId: 'T-1', amount: 190, date: new Date().toISOString() }],
    });
    res = await as(admin).post('/api/finance/wallet-reconciliation/run', { date: dhakaDate(new Date()) });
    expect(res.status).toBe(200);
    expect(res.body.totals).toMatchObject({ matched: 1, mismatch: 0, unresolved: 0 });
    expect(res.body.records[0].orderNumber).toBe(billB.orderNumber);

    // 7. Vendor statement -> approve -> pay
    const now = new Date();
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    const iso = (date) => date.toISOString().slice(0, 10);
    res = await as(admin).post(`/api/vendors/${ids.vendor}/statements`, { startDate: iso(first), endDate: iso(last) });
    expect(res.status).toBe(201);
    expect(res.body.statement).toMatchObject({
      status: 'Draft', openingStock: 0, receipts: 98, sales: 6, returns: 1,
      closingStock: 93, salesValueAtVendorPrice: 360, netPayable: 300,
    });
    const statementId = res.body.statement._id;
    res = await as(admin).patch(`/api/vendors/statements/${statementId}/status`, { status: 'Approved' });
    expect(res.status).toBe(200);
    res = await as(admin).patch(`/api/vendors/statements/${statementId}/status`, {
      status: 'Paid', paymentMethod: 'Bank', paymentReference: 'TRX-77', paidAt: new Date().toISOString(), receiverName: 'Rahim',
    });
    expect(res.status).toBe(200);
    expect(res.body.statement.status).toBe('Paid');
    res = await as(admin).patch(`/api/vendors/statements/${statementId}/status`, { status: 'Approved' });
    expect(res.status).toBe(409);
    const paid = await m.VendorStatement.findById(statementId).lean();
    expect(paid.settlementRef).toBeTruthy();
    expect((await m.GoodsReceive.findOne({ ownerType: 'VENDOR' })).settlementRef).toBe(paid.settlementRef);

    // 8. Expenses
    for (const [index, [amount, description]] of [[150, 'Shop rent'], [50, 'Electricity']].entries()) {
      res = await as(admin).post('/api/finance/expenses', {
        categoryId: ids.expenseCategories[index], amount, description, paymentMethod: 'Cash', locationId: outlet._id.toString(),
      });
      expect(res.status).toBe(201);
    }

    // 9. Profit and loss: 200 + 20 - 10 - 200 = 10
    const dhakaNow = new Date(Date.now() + 6 * 3600 * 1000);
    const dhakaFirst = new Date(Date.UTC(dhakaNow.getUTCFullYear(), dhakaNow.getUTCMonth(), 1));
    const dhakaLast = new Date(Date.UTC(dhakaNow.getUTCFullYear(), dhakaNow.getUTCMonth() + 1, 0));
    res = await as(admin).get(`/api/reports/profit-loss?from=${iso(dhakaFirst)}&to=${iso(dhakaLast)}`);
    expect(res.status).toBe(200);
    expect(res.body.report).toMatchObject({
      marginIncome: 200, ownStockMargin: 20, discounts: 10, expenses: 200, netProfit: 10,
    });
    expect(res.body.report.expensesByCategory).toEqual([
      expect.objectContaining({ category: 'Rent', total: 150 }),
      expect.objectContaining({ category: 'Utilities', total: 50 }),
    ]);

    // Every write was audited
    const actions = (await m.AuditLog.find({}).lean()).map((log) => `${log.entity}:${log.action}`);
    ['Vendor:CREATE', 'GoodsReceive:APPROVE', 'Order:FINALIZE', 'Order:RETURN', 'Shift:CLOSE', 'VendorStatement:UPDATE']
      .forEach((expected) => expect(actions).toContain(expected));
  });
});
