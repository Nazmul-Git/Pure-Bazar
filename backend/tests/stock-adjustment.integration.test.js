const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');

jest.mock('../models', () => ({
  AuditLog: { create: jest.fn() },
  Location: { findById: jest.fn() },
  Product: { find: jest.fn() },
  Settings: { findOne: jest.fn() },
  StockAdjustment: { create: jest.fn(), find: jest.fn(), findById: jest.fn() },
  StockCount: { create: jest.fn(), find: jest.fn(), findById: jest.fn() },
  StockMovement: { aggregate: jest.fn(), create: jest.fn() },
  User: { findById: jest.fn() },
}));

const {
  AuditLog, Location, Product, Settings, StockAdjustment, StockCount, StockMovement, User,
} = require('../models');
const stockRoutes = require('../routes/stockRoutes');
const errorMiddleware = require('../middlewares/errorMiddleware');

const secret = 'stock-adjustment-integration-test-secret';
const ids = {
  warehouse: '65b000000000000000000001',
  manager: '65b000000000000000000002',
  admin: '65b000000000000000000003',
  product: '65b000000000000000000004',
};
const product = {
  _id: new mongoose.Types.ObjectId(ids.product),
  name: 'Sample Product',
  barcode: '1234567890123',
  vendorPrice: 20,
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function query(value) {
  const result = {
    select: jest.fn(() => result),
    sort: jest.fn(() => result),
    limit: jest.fn(() => result),
    session: jest.fn(() => result),
    lean: jest.fn(() => Promise.resolve(value)),
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
  return result;
}

function document(data) {
  return {
    ...data,
    _id: data._id || new mongoose.Types.ObjectId(),
    toObject() { return clone({ ...this, toObject: undefined, save: undefined }); },
    async save() {},
  };
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', stockRoutes);
  app.use(errorMiddleware);
  return app;
}

describe('stock adjustment and count API', () => {
  const app = createApp();
  let user;
  let movements;
  let adjustments;
  let counts;
  let auditLogs;

  function auth(userId = ids.manager) {
    return { Authorization: `Bearer ${jwt.sign({ sub: userId }, secret)}` };
  }

  function stockAt(warehouseId, productId) {
    return movements.filter((movement) => (
      movement.warehouseId.toString() === warehouseId
      && movement.productId.toString() === productId
    )).reduce((total, movement) => total + movement.quantity, 0);
  }

  beforeEach(() => {
    process.env.JWT_SECRET = secret;
    jest.clearAllMocks();
    user = {
      _id: new mongoose.Types.ObjectId(ids.manager),
      isActive: true,
      roleId: { name: 'Inventory Manager', permissions: ['stock:read', 'stock:write'] },
    };
    movements = [{
      productId: new mongoose.Types.ObjectId(ids.product),
      warehouseId: new mongoose.Types.ObjectId(ids.warehouse),
      quantity: 10,
      type: 'GRN',
    }];
    adjustments = new Map();
    counts = new Map();
    auditLogs = [];
    const session = {
      withTransaction: jest.fn(async (callback) => callback()),
      endSession: jest.fn(),
    };
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
    User.findById.mockReturnValue({ populate: jest.fn().mockImplementation(async () => user) });
    Location.findById.mockImplementation(() => query({ _id: new mongoose.Types.ObjectId(ids.warehouse) }));
    Product.find.mockImplementation((filter) => query(
      filter._id?.$in
        ? [product].filter(({ _id }) => filter._id.$in.some((id) => id.toString() === _id.toString()))
        : [product],
    ));
    Settings.findOne.mockReturnValue(query({ stockAdjustmentApprovalLimit: 100 }));
    AuditLog.create.mockImplementation(async (logs) => { auditLogs.push(...logs); return logs; });
    StockMovement.aggregate.mockImplementation((pipeline) => {
      const filter = pipeline[0].$match;
      if (!filter.productId) {
        const stock = new Map();
        movements.filter((movement) => movement.warehouseId.toString() === filter.warehouseId.toString())
          .forEach((movement) => {
            const id = movement.productId.toString();
            stock.set(id, (stock.get(id) || 0) + movement.quantity);
          });
        return [...stock].map(([id, quantity]) => ({ _id: new mongoose.Types.ObjectId(id), quantity }));
      }
      return {
        session: jest.fn(async () => {
        const productIds = new Set(filter.productId.$in.map((id) => id.toString()));
        const stock = new Map();
        movements.filter((movement) => (
          movement.warehouseId.toString() === filter.warehouseId.toString()
          && productIds.has(movement.productId.toString())
        )).forEach((movement) => {
          const id = movement.productId.toString();
          stock.set(id, (stock.get(id) || 0) + movement.quantity);
        });
        return [...stock].map(([id, quantity]) => ({ _id: new mongoose.Types.ObjectId(id), quantity }));
        }),
      };
    });
    StockMovement.create.mockImplementation(async (docs) => { movements.push(...docs); return docs; });
    StockAdjustment.create.mockImplementation(async ([data]) => {
      const item = document({ status: 'Pending', ...data });
      adjustments.set(item._id.toString(), item);
      return [item];
    });
    StockAdjustment.findById.mockImplementation((id) => query(adjustments.get(id.toString()) || null));
    StockAdjustment.find.mockReturnValue({ sort: jest.fn(() => query([...adjustments.values()])) });
    StockCount.create.mockImplementation(async ([data]) => {
      const item = document(data);
      counts.set(item._id.toString(), item);
      return [item];
    });
    StockCount.findById.mockImplementation((id) => query(counts.get(id.toString()) || null));
    StockCount.find.mockReturnValue({ sort: jest.fn(() => query([...counts.values()])) });
  });

  afterEach(() => jest.restoreAllMocks());

  it('posts adjustments at the configured limit and requires Super Admin approval above it', async () => {
    const missingReason = await request(app).post('/api/stock-adjustments').set(auth()).send({
      warehouseId: ids.warehouse,
      lines: [{ productId: ids.product, quantity: 1 }],
    });
    expect(missingReason.status).toBe(400);
    expect(movements).toHaveLength(1);

    const atLimit = await request(app).post('/api/stock-adjustments').set(auth()).send({
      warehouseId: ids.warehouse,
      mode: 'ADD',
      reason: 'Data entry correction',
      lines: [{ productId: ids.product, quantity: 5 }],
    });
    expect(atLimit.status).toBe(201);
    expect(atLimit.body.stockAdjustment).toMatchObject({ value: 100, approvalLimit: 100, status: 'Approved' });
    expect(stockAt(ids.warehouse, ids.product)).toBe(15);

    const aboveLimit = await request(app).post('/api/stock-adjustments').set(auth()).send({
      warehouseId: ids.warehouse,
      mode: 'REMOVE',
      reason: 'Damaged',
      lines: [{ productId: ids.product, quantity: 6 }],
    });
    expect(aboveLimit.status).toBe(201);
    expect(aboveLimit.body.stockAdjustment).toMatchObject({ value: 120, status: 'Pending' });
    expect(stockAt(ids.warehouse, ids.product)).toBe(15);

    const denied = await request(app).post(`/api/stock-adjustments/${aboveLimit.body.stockAdjustment._id}/approve`)
      .set(auth());
    expect(denied.status).toBe(403);
    user = {
      _id: new mongoose.Types.ObjectId(ids.admin),
      isActive: true,
      roleId: { name: 'Super Admin', permissions: ['*'] },
    };
    const approved = await request(app).post(`/api/stock-adjustments/${aboveLimit.body.stockAdjustment._id}/approve`)
      .set(auth(ids.admin));
    expect(approved.status).toBe(200);
    expect(approved.body.stockAdjustment.status).toBe('Approved');
    expect(stockAt(ids.warehouse, ids.product)).toBe(9);
    expect(movements[movements.length - 1]).toMatchObject({ type: 'ADJUSTMENT', quantity: -6 });
    expect(auditLogs.some((entry) => entry.action === 'APPROVE' && entry.entity === 'StockAdjustment')).toBe(true);
  });

  it('rejects reason and mode mismatches and stores a required note for Other', async () => {
    const invalidReasons = [
      { mode: 'ADD', reason: 'Damaged' },
      { mode: 'REMOVE', reason: 'Found extra stock' },
      { mode: 'ADD', reason: 'Other' },
    ];
    for (const invalid of invalidReasons) {
      const response = await request(app).post('/api/stock-adjustments').set(auth()).send({
        warehouseId: ids.warehouse,
        ...invalid,
        lines: [{ productId: ids.product, quantity: 1 }],
      });
      expect(response.status).toBe(400);
    }
    expect(movements).toHaveLength(1);
    expect(adjustments.size).toBe(0);

    const validOther = await request(app).post('/api/stock-adjustments').set(auth()).send({
      warehouseId: ids.warehouse,
      mode: 'ADD',
      reason: 'Other',
      reasonNote: 'Unrecorded delivery',
      lines: [{ productId: ids.product, quantity: 2 }],
    });
    expect(validOther.status).toBe(201);
    expect(validOther.body.stockAdjustment.reason).toBe('Other: Unrecorded delivery');
    expect(movements[movements.length - 1]).toMatchObject({ type: 'ADJUSTMENT', quantity: 2 });
  });

  it('blocks removing more than the current location stock', async () => {
    const response = await request(app).post('/api/stock-adjustments').set(auth()).send({
      warehouseId: ids.warehouse,
      mode: 'REMOVE',
      reason: 'Lost or stolen',
      lines: [{ productId: ids.product, quantity: 11 }],
    });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('Cannot remove more stock than is currently available at this location');
    expect(stockAt(ids.warehouse, ids.product)).toBe(10);
    expect(adjustments.size).toBe(0);
  });

  it('searches adjustment products on the server with location stock and remove-mode filtering', async () => {
    const removeResults = await request(app).get('/api/stock/products').set(auth()).query({
      warehouseId: ids.warehouse, mode: 'REMOVE', q: 'Sample', limit: 10,
    });
    expect(removeResults.status).toBe(200);
    expect(removeResults.body.products).toMatchObject([{
      id: ids.product, name: 'Sample Product', stockQuantity: 10,
    }]);

    movements = [];
    const addResults = await request(app).get('/api/stock/products').set(auth()).query({
      warehouseId: ids.warehouse, mode: 'ADD', q: 'Sample', limit: 10,
    });
    expect(addResults.status).toBe(200);
    expect(addResults.body.products).toMatchObject([{ id: ids.product, stockQuantity: 0 }]);

    const emptyRemoveResults = await request(app).get('/api/stock/products').set(auth()).query({
      warehouseId: ids.warehouse, mode: 'REMOVE', q: 'Sample', limit: 10,
    });
    expect(emptyRemoveResults.status).toBe(200);
    expect(emptyRemoveResults.body.products).toEqual([]);
  });

  it('records system and counted quantities then posts only the calculated difference', async () => {
    const created = await request(app).post('/api/stock-counts').set(auth()).send({
      warehouseId: ids.warehouse,
      reason: 'Monthly stock count',
      lines: [{ productId: ids.product, countedQuantity: 12 }],
    });
    expect(created.status).toBe(201);
    expect(created.body.stockCount.lines[0]).toMatchObject({
      expectedQuantity: 10,
      countedQuantity: 12,
      difference: 2,
    });

    const posted = await request(app).post(`/api/stock-counts/${created.body.stockCount._id}/post`).set(auth());
    expect(posted.status).toBe(200);
    expect(posted.body.stockCount.status).toBe('Posted');
    expect(stockAt(ids.warehouse, ids.product)).toBe(12);
    expect(movements[movements.length - 1]).toMatchObject({
      type: 'ADJUSTMENT',
      quantity: 2,
      reason: 'Monthly stock count',
      referenceType: 'StockAdjustment',
    });
    expect([...adjustments.values()][0].stockCountId.toString()).toBe(created.body.stockCount._id);
    expect(auditLogs.some((entry) => entry.entity === 'StockCount' && entry.action === 'POST')).toBe(true);
  });
});
