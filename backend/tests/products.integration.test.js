const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');

jest.mock('../models', () => ({
  AuditLog: { create: jest.fn() },
  Brand: { exists: jest.fn() },
  Category: { exists: jest.fn() },
  PriceHistory: { create: jest.fn() },
  Product: { create: jest.fn(), find: jest.fn(), findById: jest.fn() },
  Settings: { findOne: jest.fn() },
  Unit: { exists: jest.fn() },
  User: { findById: jest.fn() },
  Vendor: { exists: jest.fn() },
}));

const {
  AuditLog, Brand, Category, PriceHistory, Product, Settings, Unit, User, Vendor,
} = require('../models');
const productRoutes = require('../routes/productRoutes');
const errorMiddleware = require('../middlewares/errorMiddleware');

const secret = 'products-integration-test-secret';
const adminId = '65b000000000000000000001';
const productId = '65b000000000000000000002';
const categoryId = '65b000000000000000000003';
const unitId = '65b000000000000000000004';
const admin = {
  _id: { toString: () => adminId },
  isActive: true,
  roleId: { name: 'Inventory Manager', permissions: ['products:read', 'products:write'] },
};
const product = {
  _id: productId,
  name: 'Rice',
  categoryId,
  unitId,
  ownerType: 'COMPANY',
  vendorPrice: 95,
  mrp: 100,
  margin: 5,
  vatApplicable: true,
  vatRate: 5,
  barcode: 'PB0123456789ABCDEF012345',
  createdAt: new Date('2026-10-01'),
  updatedAt: new Date('2026-10-01'),
};

function chain(value) {
  const result = {
    sort: jest.fn(() => result),
    lean: jest.fn(() => Promise.resolve(value)),
  };
  return result;
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/products', productRoutes);
  app.use(errorMiddleware);
  return app;
}

function token() {
  return jwt.sign({ sub: adminId }, secret, { expiresIn: '1h' });
}

describe('product endpoints', () => {
  const app = createApp();
  const auth = { Authorization: `Bearer ${token()}` };

  beforeEach(() => {
    process.env.JWT_SECRET = secret;
    jest.clearAllMocks();
    User.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(admin) });
    Settings.findOne.mockReturnValue(chain({ shareholderDiscountPercent: 5 }));
    Category.exists.mockResolvedValue(true);
    Brand.exists.mockResolvedValue(true);
    Unit.exists.mockResolvedValue(true);
    Vendor.exists.mockResolvedValue(true);
    AuditLog.create.mockResolvedValue({});
    PriceHistory.create.mockResolvedValue({});
    Product.find.mockReturnValue(chain([product]));
  });

  it('lists products with calculated margin warning and VAT data', async () => {
    Product.find.mockReturnValue(chain([{ ...product, vendorPrice: 96, margin: 4 }]));
    const response = await request(app).get('/api/products').set(auth);

    expect(response.status).toBe(200);
    expect(response.body.marginWarningPercent).toBe(5);
    expect(response.body.products[0]).toMatchObject({
      ownerType: 'COMPANY',
      vendorPrice: 96,
      mrp: 100,
      margin: 4,
      marginWarning: true,
      vatApplicable: true,
      vatRate: 5,
      barcode: product.barcode,
    });
  });

  it('rejects MRP below vendor price and creates products with generated barcode', async () => {
    const invalid = await request(app).post('/api/products').set(auth).send({
      name: 'Rice', categoryId, unitId, ownerType: 'COMPANY', vendorPrice: 101, mrp: 100,
    });
    Product.create.mockImplementation(async (input) => ({
      ...product,
      ...input,
      barcode: 'PB0123456789ABCDEF012345',
      margin: input.mrp - input.vendorPrice,
    }));
    const created = await request(app).post('/api/products').set(auth).send({
      name: 'Rice', categoryId, unitId, ownerType: 'COMPANY', vendorPrice: 95, mrp: 100,
      vatApplicable: true, vatRate: 5,
    });

    expect(invalid.status).toBe(400);
    expect(Product.create).toHaveBeenCalledTimes(1);
    expect(Product.create).toHaveBeenCalledWith(expect.objectContaining({
      ownerType: 'COMPANY', vendorPrice: 95, mrp: 100, vatApplicable: true, vatRate: 5,
    }));
    expect(created.status).toBe(201);
    expect(created.body.product.barcode).toBeTruthy();
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'CREATE', entity: 'Product',
    }));
  });

  it('records price history and an audit event when an authorized user changes prices', async () => {
    const current = {
      ...product,
      set: jest.fn(function set(values) { Object.assign(this, values); }),
      save: jest.fn(async function save() {
        this.margin = Math.round((this.mrp - this.vendorPrice + Number.EPSILON) * 100) / 100;
      }),
    };
    Product.findById.mockReturnValue(current);
    const response = await request(app).put(`/api/products/${productId}`).set(auth).send({
      vendorPrice: 90, mrp: 110, reason: 'Supplier cost update',
    });

    expect(response.status).toBe(200);
    expect(response.body.product).toMatchObject({ vendorPrice: 90, mrp: 110, margin: 20, marginWarning: false });
    expect(PriceHistory.create).toHaveBeenCalledWith(expect.objectContaining({
      productId: productId,
      oldVendorPrice: 95,
      newVendorPrice: 90,
      oldMrp: 100,
      newMrp: 110,
      changedBy: admin._id,
      reason: 'Supplier cost update',
    }));
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'UPDATE', entity: 'Product', metadata: { priceChanged: true },
    }));
  });

  it('denies cashiers permission to change prices', async () => {
    User.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue({
      ...admin, roleId: { name: 'Outlet Cashier', permissions: ['pos:write'] },
    }) });
    const response = await request(app).put(`/api/products/${productId}`).set(auth)
      .send({ mrp: 110 });

    expect(response.status).toBe(403);
    expect(Product.findById).not.toHaveBeenCalled();
    expect(PriceHistory.create).not.toHaveBeenCalled();
    expect(AuditLog.create).not.toHaveBeenCalled();
  });
});
