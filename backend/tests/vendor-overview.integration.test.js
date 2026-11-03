const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');

jest.mock('../models', () => ({
  Location: { find: jest.fn() },
  Product: { find: jest.fn() },
  StockMovement: { aggregate: jest.fn() },
  User: { findById: jest.fn() },
  Vendor: { findById: jest.fn() },
  VendorLedger: { aggregate: jest.fn() },
}));

const models = require('../models');
const vendorRoutes = require('../routes/vendorRoutes');
const errorMiddleware = require('../middlewares/errorMiddleware');

const secret = 'vendor-overview-integration-test-secret';
const userId = new mongoose.Types.ObjectId('65c000000000000000000001');
const vendorId = new mongoose.Types.ObjectId('65c000000000000000000002');
const productId = new mongoose.Types.ObjectId('65c000000000000000000003');

function query(value) {
  const chain = {
    select: jest.fn(() => chain),
    sort: jest.fn(() => chain),
    lean: jest.fn(async () => value),
  };
  return chain;
}

describe('vendor overview API', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/vendors', vendorRoutes);
  app.use(errorMiddleware);
  const auth = { Authorization: `Bearer ${jwt.sign({ sub: userId.toString() }, secret)}` };

  beforeEach(() => {
    process.env.JWT_SECRET = secret;
    jest.clearAllMocks();
    models.User.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        _id: userId, isActive: true, roleId: { name: 'Manager', permissions: ['vendors:read'] },
      }),
    });
    models.Vendor.findById.mockReturnValue(query({
      _id: vendorId, name: 'Rahim', memberId: 'PB-1', shopName: 'Rahim Store', productCategory: 'Food', mobile: '01700000000',
    }));
    models.Product.find.mockReturnValue(query([{ _id: productId, name: 'Rice', vendorPrice: 0.1, mrp: 0.2 }]));
    models.Location.find.mockReturnValue(query([{ _id: new mongoose.Types.ObjectId() }]));
    models.StockMovement.aggregate.mockResolvedValue([{
      _id: productId, warehouse: 0.1 + 0.2, outlets: 4, received: 10,
    }]);
    models.VendorLedger.aggregate.mockResolvedValue([{ _id: productId, soldQty: 3, payableCents: 30 }]);
  });

  it('returns per-product stock, sales and an aggregated summary without float glitches', async () => {
    const response = await request(app).get(`/api/vendors/${vendorId}/overview`).set(auth);

    expect(response.status).toBe(200);
    expect(response.body.vendor.memberId).toBe('PB-1');
    expect(response.body.products[0]).toMatchObject({
      receivedQty: 10, warehouseStock: 0.3, outletStock: 4, currentStock: 4.3, soldQty: 3, payable: 0.3,
    });
    expect(response.body.summary).toEqual({
      totalProducts: 1, totalAvailableStock: 4.3, totalSoldUnits: 3, totalValuation: 0.43, totalPayable: 0.3,
    });
  });

  it('rejects an invalid date range', async () => {
    const response = await request(app)
      .get(`/api/vendors/${vendorId}/overview?startDate=2026-08-10&endDate=2026-08-01`).set(auth);
    expect(response.status).toBe(400);
  });

  it('returns 404 for an unknown vendor', async () => {
    models.Vendor.findById.mockReturnValue(query(null));
    const response = await request(app).get(`/api/vendors/${vendorId}/overview`).set(auth);
    expect(response.status).toBe(404);
  });
});
