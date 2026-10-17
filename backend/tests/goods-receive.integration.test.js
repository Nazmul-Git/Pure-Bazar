const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');

jest.mock('../models', () => ({
  AuditLog: { create: jest.fn() },
  GoodsReceive: { create: jest.fn(), find: jest.fn(), findById: jest.fn() },
  Product: { find: jest.fn() },
  StockMovement: { aggregate: jest.fn(), create: jest.fn() },
  User: { findById: jest.fn() },
  Vendor: { exists: jest.fn() },
}));

const { AuditLog, GoodsReceive, Product, StockMovement, User, Vendor } = require('../models');
const stockRoutes = require('../routes/stockRoutes');
const errorMiddleware = require('../middlewares/errorMiddleware');

const secret = 'goods-receive-integration-test-secret';
const adminId = '65b000000000000000000001';
const warehouseId = '65b000000000000000000002';
const productId = '65b000000000000000000003';
const vendorId = '65b000000000000000000004';
const admin = {
  _id: adminId,
  isActive: true,
  roleId: { name: 'Inventory Manager', permissions: ['stock:read', 'stock:write'] },
};
const rice = { _id: productId, name: 'Rice', barcode: '4006381333931', ownerType: 'COMPANY' };

function productQuery(result) {
  const query = {
    select: jest.fn(() => query),
    sort: jest.fn(() => query),
    lean: jest.fn(() => Promise.resolve(result)),
  };
  return query;
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', stockRoutes);
  app.use(errorMiddleware);
  return app;
}

function newReceive(data) {
  return {
    ...data,
    _id: new mongoose.Types.ObjectId(),
    status: data.status || 'Draft',
    toObject() {
      return { ...this, toObject: undefined, save: undefined, _id: this._id };
    },
    async save() {},
  };
}

describe('goods receive and movement-derived stock endpoints', () => {
  const app = createApp();
  const auth = { Authorization: `Bearer ${jwt.sign({ sub: adminId }, secret, { expiresIn: '1h' })}` };
  let receives;
  let movements;
  let session;

  function currentStock() {
    return movements.reduce((sum, movement) => sum + movement.quantity, 0);
  }

  beforeEach(() => {
    process.env.JWT_SECRET = secret;
    jest.clearAllMocks();
    receives = new Map();
    movements = [];
    session = {
      withTransaction: jest.fn(async (callback) => {
        const savedReceives = new Map([...receives].map(([key, value]) => [key, { ...value }]));
        const savedMovements = [...movements];
        try {
          await callback();
        } catch (error) {
          receives = savedReceives;
          movements = savedMovements;
          throw error;
        }
      }),
      endSession: jest.fn(),
    };
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
    User.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(admin) });
    Vendor.exists.mockResolvedValue(true);
    Product.find.mockImplementation(() => productQuery([rice]));
    AuditLog.create.mockResolvedValue({});
    GoodsReceive.create.mockImplementation(async ([data]) => {
      const receive = newReceive(data);
      receives.set(receive._id.toString(), receive);
      return [receive];
    });
    GoodsReceive.findById.mockImplementation((id) => {
      const receive = receives.get(id.toString()) || null;
      return {
        session: jest.fn(() => Promise.resolve(receive)),
        lean: jest.fn(() => Promise.resolve(receive)),
        then: (resolve, reject) => Promise.resolve(receive).then(resolve, reject),
      };
    });
    GoodsReceive.find.mockReturnValue({
      sort: jest.fn(() => ({ lean: jest.fn(async () => [...receives.values()]) })),
    });
    StockMovement.create.mockImplementation(async (docs) => {
      movements.push(...docs);
      return docs;
    });
    StockMovement.aggregate.mockImplementation(async () => (
      currentStock() ? [{ _id: new mongoose.Types.ObjectId(productId), quantity: currentStock() }] : []
    ));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function createDraft(lines = [{
    productId, receivedQuantity: 13, acceptedQuantity: 13, rejectedQuantity: 0,
  }]) {
    return request(app).post('/api/goods-receives').set(auth).send({
      ownerType: 'COMPANY', warehouseId, lines,
    });
  }

  it('combines repeated products, approves accepted quantity, and returns stock as movement sum', async () => {
    const draft = await createDraft([
      { productId, receivedQuantity: 10, acceptedQuantity: 10, rejectedQuantity: 0 },
      { productId, receivedQuantity: 3, acceptedQuantity: 3, rejectedQuantity: 0 },
    ]);
    expect(draft.status).toBe(201);
    expect(draft.body.goodsReceive.lines).toHaveLength(1);
    expect(draft.body.goodsReceive.lines[0]).toMatchObject({
      receivedQuantity: 13, acceptedQuantity: 13, rejectedQuantity: 0,
    });
    expect(currentStock()).toBe(0);

    const id = draft.body.goodsReceive.id;
    const approved = await request(app).post(`/api/goods-receives/${id}/approve`).set(auth);
    expect(approved.status).toBe(200);
    expect(approved.body.goodsReceive.status).toBe('Approved');
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ quantity: 13, type: 'GRN', warehouseId, productId });

    const stock = await request(app).get(`/api/stock?warehouseId=${warehouseId}`).set(auth);
    expect(stock.status).toBe(200);
    expect(stock.body.stock).toEqual([expect.objectContaining({ productId, quantity: 13 })]);
  });

  it('keeps a draft out of stock', async () => {
    const response = await createDraft();
    expect(response.status).toBe(201);
    expect(currentStock()).toBe(0);
    expect(StockMovement.create).not.toHaveBeenCalled();
  });

  it('returns printable line details and keeps rejected receives out of stock', async () => {
    const draft = await createDraft([{
      productId, receivedQuantity: 15, acceptedQuantity: 10, rejectedQuantity: 5,
    }]);
    const id = draft.body.goodsReceive.id;
    const printable = await request(app).get(`/api/goods-receives/${id}/print`).set(auth);
    expect(printable.status).toBe(200);
    expect(printable.body.goodsReceive.lines[0]).toMatchObject({
      productName: 'Rice', receivedQuantity: 15, acceptedQuantity: 10, rejectedQuantity: 5,
    });

    const rejected = await request(app).post(`/api/goods-receives/${id}/reject`).set(auth);
    expect(rejected.status).toBe(200);
    expect(rejected.body.goodsReceive.status).toBe('Rejected');
    expect(currentStock()).toBe(0);
    expect(StockMovement.create).not.toHaveBeenCalled();
  });

  it('prevents editing an approved GRN', async () => {
    const draft = await createDraft();
    const id = draft.body.goodsReceive.id;
    await request(app).post(`/api/goods-receives/${id}/approve`).set(auth);
    const update = await request(app).put(`/api/goods-receives/${id}`).set(auth).send({
      lines: [{ productId, receivedQuantity: 20, acceptedQuantity: 20, rejectedQuantity: 0 }],
    });
    expect(update.status).toBe(409);
    expect(currentStock()).toBe(13);
  });

  it('rolls back stock when approval fails', async () => {
    const draft = await createDraft();
    const id = draft.body.goodsReceive.id;
    StockMovement.create.mockImplementationOnce(async (docs) => {
      movements.push(...docs);
      throw new Error('movement insert failed');
    });

    const approval = await request(app).post(`/api/goods-receives/${id}/approve`).set(auth);
    expect(approval.status).toBe(500);
    expect(currentStock()).toBe(0);
    expect(receives.get(id).status).toBe('Draft');
    expect(session.endSession).toHaveBeenCalled();
  });

  it('does not expose any direct stock-setting operation', async () => {
    const response = await request(app).put(`/api/stock?warehouseId=${warehouseId}`).set(auth)
      .send({ productId, quantity: 500 });
    expect(response.status).toBe(404);
    expect(StockMovement.create).not.toHaveBeenCalled();
  });

  it('restricts vendor product search to that vendor', async () => {
    await request(app).get(`/api/stock/products?ownerType=VENDOR&vendorId=${vendorId}`).set(auth);
    expect(Product.find).toHaveBeenCalledWith({ ownerType: 'VENDOR', vendorId });
  });
});
