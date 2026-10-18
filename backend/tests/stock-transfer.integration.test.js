const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');

jest.mock('../models', () => ({
  AuditLog: { create: jest.fn() },
  Location: { find: jest.fn(), findById: jest.fn() },
  Product: { find: jest.fn() },
  StockMovement: { aggregate: jest.fn(), create: jest.fn() },
  StockTransfer: { create: jest.fn(), find: jest.fn(), findOne: jest.fn() },
  User: { findById: jest.fn() },
}));

const {
  AuditLog, Location, Product, StockMovement, StockTransfer, User,
} = require('../models');
const stockRoutes = require('../routes/stockRoutes');
const errorMiddleware = require('../middlewares/errorMiddleware');

const secret = 'stock-transfer-integration-test-secret';
const centralId = '65b000000000000000000001';
const outletId = '65b000000000000000000002';
const otherOutletId = '65b000000000000000000003';
const warehouseUserId = '65b000000000000000000004';
const outletUserId = '65b000000000000000000005';
const productId = '65b000000000000000000006';
const transferId = '65b000000000000000000007';
const locations = new Map([
  [centralId, { _id: new mongoose.Types.ObjectId(centralId), type: 'CENTRAL' }],
  [outletId, { _id: new mongoose.Types.ObjectId(outletId), type: 'OUTLET' }],
  [otherOutletId, { _id: new mongoose.Types.ObjectId(otherOutletId), type: 'OUTLET' }],
]);
const product = {
  _id: new mongoose.Types.ObjectId(productId),
  name: 'Sample Product',
  barcode: '1234567890123',
};

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', stockRoutes);
  app.use(errorMiddleware);
  return app;
}

function query(value) {
  const result = {
    select: jest.fn(() => result),
    sort: jest.fn(() => result),
    lean: jest.fn(() => Promise.resolve(value)),
    session: jest.fn(() => result),
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
  return result;
}

function cloneTransfer(transfer) {
  return {
    ...transfer,
    lines: transfer.lines.map((line) => ({ ...line })),
  };
}

function transferDocument(data) {
  const transfer = {
    ...data,
    _id: data._id || new mongoose.Types.ObjectId(transferId),
    status: data.status || 'Requested',
    lines: data.lines.map((line) => ({
      ...line,
      productId: new mongoose.Types.ObjectId(line.productId),
    })),
    toObject() {
      return cloneTransfer(this);
    },
    async save() {},
  };
  return transfer;
}

describe('stock transfer API', () => {
  const app = createApp();
  let currentUser;
  let transfers;
  let movements;
  let session;

  function auth(userId) {
    return { Authorization: `Bearer ${jwt.sign({ sub: userId }, secret)}` };
  }

  function stockAt(locationId) {
    return movements
      .filter((movement) => movement.warehouseId.toString() === locationId)
      .reduce((sum, movement) => sum + movement.quantity, 0);
  }

  function totalStock() {
    return movements.reduce((sum, movement) => sum + movement.quantity, 0);
  }

  async function createRequestedTransfer(quantity = 10) {
    return request(app).post('/api/stock-transfers').set(auth(warehouseUserId)).send({
      fromWarehouseId: centralId,
      toWarehouseId: outletId,
      lines: [{ productId, requestedQuantity: quantity }],
    });
  }

  beforeEach(() => {
    process.env.JWT_SECRET = secret;
    jest.clearAllMocks();
    currentUser = {
      _id: warehouseUserId,
      isActive: true,
      roleId: {
        name: 'Warehouse Staff',
        permissions: ['stock:transfer:read', 'stock:transfer:write'],
      },
      locationId: new mongoose.Types.ObjectId(centralId),
    };
    transfers = new Map();
    movements = [{
      productId: new mongoose.Types.ObjectId(productId),
      warehouseId: new mongoose.Types.ObjectId(centralId),
      quantity: 50,
      type: 'GRN',
    }];
    session = {
      withTransaction: jest.fn(async (callback) => {
        const savedTransfers = new Map([...transfers].map(([key, value]) => [key, cloneTransfer(value)]));
        const savedMovements = [...movements];
        try {
          await callback();
        } catch (error) {
          transfers = savedTransfers;
          movements = savedMovements;
          throw error;
        }
      }),
      endSession: jest.fn(),
    };
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
    User.findById.mockReturnValue({ populate: jest.fn().mockImplementation(async () => currentUser) });
    Location.findById.mockImplementation((id) => query(locations.get(id.toString()) || null));
    Product.find.mockReturnValue(query([product]));
    AuditLog.create.mockResolvedValue([]);
    StockTransfer.create.mockImplementation(async ([data]) => {
      const transfer = transferDocument(data);
      transfers.set(transfer._id.toString(), transfer);
      return [transfer];
    });
    StockTransfer.find.mockImplementation((filter) => query(
      [...transfers.values()].filter((transfer) => Object.entries(filter).every(([key, value]) => (
        transfer[key]?.toString() === value.toString()
      ))).map(cloneTransfer),
    ));
    StockTransfer.findOne.mockImplementation((filter) => {
      const transfer = transfers.get(filter._id.toString());
      const matches = transfer && Object.entries(filter).every(([key, value]) => (
        transfer[key]?.toString() === value.toString()
      ));
      return query(matches ? transfer : null);
    });
    StockMovement.aggregate.mockImplementation((pipeline) => {
      const match = pipeline[0].$match;
      const sums = new Map();
      movements.filter((movement) => (
        movement.warehouseId.toString() === match.warehouseId.toString()
        && match.productId.$in.some((id) => id.toString() === movement.productId.toString())
      )).forEach((movement) => {
        const id = movement.productId.toString();
        sums.set(id, (sums.get(id) || 0) + movement.quantity);
      });
      return {
        session: jest.fn(async () => [...sums].map(([id, quantity]) => ({
          _id: new mongoose.Types.ObjectId(id), quantity,
        }))),
      };
    });
    StockMovement.create.mockImplementation(async (docs) => {
      movements.push(...docs);
      return docs;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requests, dispatches, and confirms an exact transfer without changing total stock', async () => {
    const requested = await createRequestedTransfer();
    const id = requested.body.stockTransfer.id;
    expect(requested.status).toBe(201);
    expect(requested.body.stockTransfer.status).toBe('Requested');
    expect(requested.body.stockTransfer.lines[0]).toMatchObject({
      productName: 'Sample Product',
      barcode: '1234567890123',
    });
    expect(totalStock()).toBe(50);

    const warehouseList = await request(app).get('/api/stock-transfers').set(auth(warehouseUserId));
    expect(warehouseList.body.stockTransfers).toHaveLength(1);
    expect(StockTransfer.find).toHaveBeenCalledWith({ fromWarehouseId: centralId });

    currentUser = {
      _id: outletUserId,
      isActive: true,
      roleId: {
        name: 'Outlet Cashier',
        permissions: ['stock:transfer:read', 'stock:transfer:receive'],
      },
      locationId: new mongoose.Types.ObjectId(outletId),
    };
    Location.find.mockImplementation(() => query([...locations.values()]));
    const outletLocations = await request(app).get('/api/locations').set(auth(outletUserId));
    expect(outletLocations.status).toBe(200);

    const outletList = await request(app).get('/api/stock-transfers').set(auth(outletUserId));
    expect(outletList.body.stockTransfers).toHaveLength(1);
    expect(StockTransfer.find).toHaveBeenCalledWith({ toWarehouseId: outletId });

    currentUser = {
      _id: warehouseUserId,
      isActive: true,
      roleId: { name: 'Warehouse Staff', permissions: ['stock:transfer:read', 'stock:transfer:write'] },
      locationId: new mongoose.Types.ObjectId(centralId),
    };
    const dispatched = await request(app).post(`/api/stock-transfers/${id}/dispatch`)
      .set(auth(warehouseUserId)).send({ lines: [{ productId, dispatchedQuantity: 10 }] });
    expect(dispatched.status).toBe(200);
    expect(dispatched.body.stockTransfer.status).toBe('Dispatched');
    expect(movements.at(-1)).toMatchObject({ type: 'TRANSFER_OUT', quantity: -10 });
    expect(totalStock() + 10).toBe(50);
    expect(stockAt(centralId)).toBe(40);

    currentUser = {
      _id: outletUserId,
      isActive: true,
      roleId: { name: 'Outlet Cashier', permissions: ['stock:transfer:read', 'stock:transfer:receive'] },
      locationId: new mongoose.Types.ObjectId(outletId),
    };
    const received = await request(app).post(`/api/stock-transfers/${id}/receive`)
      .set(auth(outletUserId)).send({ lines: [{ productId, receivedQuantity: 10 }] });
    expect(received.status).toBe(200);
    expect(received.body.stockTransfer.status).toBe('Received');
    expect(movements.at(-1)).toMatchObject({ type: 'TRANSFER_IN', quantity: 10 });
    expect(stockAt(outletId)).toBe(10);
    expect(totalStock()).toBe(50);
  });

  it('records a receipt shortage as a discrepancy and scopes transfers to the assigned outlet', async () => {
    const requested = await createRequestedTransfer(8);
    const id = requested.body.stockTransfer.id;
    const dispatched = await request(app).post(`/api/stock-transfers/${id}/dispatch`)
      .set(auth(warehouseUserId)).send({ lines: [{ productId, dispatchedQuantity: 8 }] });
    expect(dispatched.status).toBe(200);

    currentUser = {
      _id: outletUserId,
      isActive: true,
      roleId: { name: 'Outlet Cashier', permissions: ['stock:transfer:read', 'stock:transfer:receive'] },
      locationId: new mongoose.Types.ObjectId(outletId),
    };
    const received = await request(app).post(`/api/stock-transfers/${id}/receive`)
      .set(auth(outletUserId)).send({ lines: [{ productId, receivedQuantity: 6 }] });

    expect(received.status).toBe(200);
    expect(received.body.stockTransfer).toMatchObject({
      status: 'Discrepancy',
      lines: [{ dispatchedQuantity: 8, receivedQuantity: 6, discrepancyQuantity: 2 }],
    });
    expect(movements.at(-1)).toMatchObject({ type: 'TRANSFER_IN', quantity: 6 });
    expect(stockAt(centralId) + stockAt(outletId) + 2).toBe(50);

    currentUser.locationId = new mongoose.Types.ObjectId(otherOutletId);
    const hidden = await request(app).get(`/api/stock-transfers/${id}`).set(auth(outletUserId));
    expect(hidden.status).toBe(404);
  });

  it('rejects a request greater than Central Warehouse stock', async () => {
    const response = await createRequestedTransfer(51);
    const fractionalQuantity = await createRequestedTransfer(1.5);

    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/exceeds the 50 units available in the Central Warehouse/);
    expect(fractionalQuantity.status).toBe(400);
    expect(StockTransfer.create).not.toHaveBeenCalled();
    expect(transfers.size).toBe(0);
  });

  it('rejects dispatch by an outlet and prevents dispatch beyond available stock', async () => {
    const requested = await createRequestedTransfer(10);
    const id = requested.body.stockTransfer.id;
    movements.push({
      productId: new mongoose.Types.ObjectId(productId),
      warehouseId: new mongoose.Types.ObjectId(centralId),
      quantity: -45,
      type: 'TRANSFER_OUT',
    });
    currentUser = {
      _id: outletUserId,
      isActive: true,
      roleId: { name: 'Outlet Cashier', permissions: ['stock:transfer:read', 'stock:transfer:receive'] },
      locationId: new mongoose.Types.ObjectId(outletId),
    };
    const wrongSide = await request(app).post(`/api/stock-transfers/${id}/dispatch`)
      .set(auth(outletUserId)).send({ lines: [{ productId, dispatchedQuantity: 6 }] });
    expect(wrongSide.status).toBe(403);

    currentUser = {
      _id: warehouseUserId,
      isActive: true,
      roleId: { name: 'Warehouse Staff', permissions: ['stock:transfer:read', 'stock:transfer:write'] },
      locationId: new mongoose.Types.ObjectId(centralId),
    };
    const excessive = await request(app).post(`/api/stock-transfers/${id}/dispatch`)
      .set(auth(warehouseUserId)).send({ lines: [{ productId, dispatchedQuantity: 6 }] });
    expect(excessive.status).toBe(409);
    expect(movements).toHaveLength(2);
    expect(transfers.get(id).status).toBe('Requested');
  });
});
