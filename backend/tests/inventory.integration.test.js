const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');

jest.mock('../models', () => ({
  AuditLog: { create: jest.fn() },
  Brand: {
    create: jest.fn(), find: jest.fn(), findById: jest.fn(),
    findByIdAndDelete: jest.fn(), findByIdAndUpdate: jest.fn(),
  },
  Category: {
    create: jest.fn(), find: jest.fn(), findById: jest.fn(),
    findByIdAndDelete: jest.fn(), findByIdAndUpdate: jest.fn(),
  },
  Product: { exists: jest.fn() },
  Unit: {
    create: jest.fn(), find: jest.fn(), findById: jest.fn(),
    findByIdAndDelete: jest.fn(), findByIdAndUpdate: jest.fn(),
  },
  User: { findById: jest.fn() },
}));

const { AuditLog, Brand, Category, Product, Unit, User } = require('../models');
const inventoryRoutes = require('../routes/inventoryRoutes');
const errorMiddleware = require('../middlewares/errorMiddleware');

const secret = 'inventory-integration-test-secret';
const adminId = '65b000000000000000000001';
const categoryId = '65b000000000000000000002';
const brandId = '65b000000000000000000003';
const unitId = '65b000000000000000000004';
const admin = {
  _id: { toString: () => adminId },
  name: 'Admin User',
  email: 'admin@example.test',
  isActive: true,
  roleId: { name: 'Super Admin', permissions: ['*'] },
};
const category = { _id: categoryId, name: 'Produce', vatRate: 5, commissionPercent: 10, commissionEnabled: false };
const brand = { _id: brandId, name: 'Fresh Co', logo: { contentType: 'image/png' } };
const unit = { _id: unitId, name: 'Bundle', abbreviation: 'bdl' };

function query(value) {
  const result = {
    select: jest.fn(() => result),
    sort: jest.fn(() => result),
    lean: jest.fn(() => Promise.resolve(value)),
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
  return result;
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', inventoryRoutes);
  app.use(errorMiddleware);
  return app;
}

function tokenFor(id = adminId) {
  return jwt.sign({ sub: id }, secret, { expiresIn: '1h' });
}

describe('inventory category, brand, and unit endpoints', () => {
  const app = createApp();
  const auth = { Authorization: `Bearer ${tokenFor()}` };

  beforeEach(() => {
    process.env.JWT_SECRET = secret;
    jest.clearAllMocks();
    AuditLog.create.mockResolvedValue({});
    User.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(admin) });
    Product.exists.mockResolvedValue(null);
    Category.find.mockReturnValue(query([category]));
    Brand.find.mockReturnValue(query([brand]));
    Unit.find.mockReturnValue(query([unit]));
    Category.findById.mockReturnValue(query(category));
    Brand.findById.mockReturnValue(query(brand));
    Unit.findById.mockReturnValue(query(unit));
    Category.create.mockResolvedValue(category);
    Brand.create.mockResolvedValue(brand);
    Unit.create.mockResolvedValue(unit);
    Category.findByIdAndUpdate.mockResolvedValue({ ...category, name: 'Fresh Produce' });
    Brand.findByIdAndUpdate.mockResolvedValue({ ...brand, name: 'Fresh Brands' });
    Unit.findByIdAndUpdate.mockResolvedValue({ ...unit, name: 'Bundles' });
    Category.findByIdAndDelete.mockResolvedValue(category);
    Brand.findByIdAndDelete.mockResolvedValue(brand);
    Unit.findByIdAndDelete.mockResolvedValue(unit);
  });

  it('lists seeded inventory values and applies category and brand read permissions', async () => {
    const categories = await request(app).get('/api/categories').set(auth);
    const brands = await request(app).get('/api/brands').set(auth);
    const units = await request(app).get('/api/units').set(auth);
    const unauthenticated = await request(app).get('/api/categories');
    User.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue({
      ...admin, roleId: { name: 'Cashier', permissions: ['units:read'] },
    }) });
    const forbidden = await request(app).get('/api/brands').set(auth);

    expect(categories.status).toBe(200);
    expect(categories.body.categories[0]).toMatchObject({ id: categoryId, vatRate: 5, commissionEnabled: false });
    expect(brands.status).toBe(200);
    expect(brands.body.brands[0].logoUrl).toBe(`/api/brands/${brandId}/logo`);
    expect(units.status).toBe(200);
    expect(units.body.units[0]).toMatchObject({ name: 'Bundle', abbreviation: 'bdl' });
    expect(unauthenticated.status).toBe(401);
    expect(forbidden.status).toBe(403);
  });

  it('creates, updates, and deletes categories while keeping commission disabled and auditing writes', async () => {
    const created = await request(app).post('/api/categories').set(auth).send({
      name: 'Produce', vatRate: 5, commissionPercent: 10,
    });
    const updated = await request(app).put(`/api/categories/${categoryId}`).set(auth).send({
      name: 'Fresh Produce', vatRate: null, commissionPercent: 10,
    });
    const removed = await request(app).delete(`/api/categories/${categoryId}`).set(auth);

    expect(created.status).toBe(201);
    expect(Category.create).toHaveBeenCalledWith({
      name: 'Produce', vatRate: 5, commissionPercent: 10, commissionEnabled: false,
    });
    expect(updated.status).toBe(200);
    expect(Category.findByIdAndUpdate).toHaveBeenCalledWith(categoryId, {
      name: 'Fresh Produce', commissionEnabled: false, vatRate: null, commissionPercent: 10,
    }, { new: true, runValidators: true });
    expect(removed.status).toBe(200);
    expect(AuditLog.create).toHaveBeenCalledTimes(3);
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'UPDATE', entity: 'Category', before: expect.any(Object), after: expect.any(Object),
    }));
  });

  it('rejects commission activation, invalid rates, and deletion of categories in use', async () => {
    const commissionEnabled = await request(app).post('/api/categories').set(auth).send({
      name: 'Produce', commissionEnabled: true,
    });
    const invalidRate = await request(app).post('/api/categories').set(auth).send({
      name: 'Produce', vatRate: 101,
    });
    Product.exists.mockResolvedValueOnce({ _id: 'product' });
    const inUse = await request(app).delete(`/api/categories/${categoryId}`).set(auth);

    expect(commissionEnabled.status).toBe(400);
    expect(invalidRate.status).toBe(400);
    expect(inUse.status).toBe(409);
    expect(Category.create).not.toHaveBeenCalled();
    expect(Category.findByIdAndDelete).not.toHaveBeenCalled();
    expect(AuditLog.create).not.toHaveBeenCalled();
  });

  it('creates, uploads, updates, lists, and deletes brands with audited logo data', async () => {
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    Brand.create.mockResolvedValue({ ...brand, logo: { contentType: 'image/png', data: png } });
    const created = await request(app).post('/api/brands').set(auth)
      .field('name', 'Fresh Co').attach('logo', png, { filename: 'logo.png', contentType: 'image/png' });
    const updated = await request(app).put(`/api/brands/${brandId}`).set(auth)
      .field('name', 'Fresh Brands').attach('logo', png, { filename: 'logo.png', contentType: 'image/png' });
    Brand.findById.mockReturnValueOnce(query({ ...brand, logo: { data: png, contentType: 'image/png' } }));
    const logo = await request(app).get(`/api/brands/${brandId}/logo`).set(auth);
    const removed = await request(app).delete(`/api/brands/${brandId}`).set(auth);

    expect(created.status).toBe(201);
    expect(Brand.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Fresh Co', logo: { data: png, contentType: 'image/png' },
    }));
    expect(updated.status).toBe(200);
    expect(logo.status).toBe(200);
    expect(logo.headers['content-type']).toMatch(/image\/png/);
    expect(logo.body).toEqual(png);
    expect(removed.status).toBe(200);
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'CREATE', entity: 'Brand', metadata: { logoUploaded: true },
    }));
  });

  it('rejects invalid logos and protects brands referenced by products', async () => {
    const invalid = await request(app).post('/api/brands').set(auth)
      .field('name', 'Fresh Co').attach('logo', Buffer.from('not an image'), {
        filename: 'logo.png', contentType: 'image/png',
      });
    Product.exists.mockResolvedValueOnce({ _id: 'product' });
    const inUse = await request(app).delete(`/api/brands/${brandId}`).set(auth);

    expect(invalid.status).toBe(400);
    expect(inUse.status).toBe(409);
    expect(Brand.create).not.toHaveBeenCalled();
    expect(Brand.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it('supports manually adding, editing, and deleting units with audit events', async () => {
    const created = await request(app).post('/api/units').set(auth).send({ name: 'Bundle', abbreviation: 'bdl' });
    const updated = await request(app).put(`/api/units/${unitId}`).set(auth).send({
      name: 'Bundles', abbreviation: 'bdls',
    });
    const removed = await request(app).delete(`/api/units/${unitId}`).set(auth);

    expect(created.status).toBe(201);
    expect(updated.status).toBe(200);
    expect(removed.status).toBe(200);
    expect(AuditLog.create).toHaveBeenCalledTimes(3);
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'CREATE', entity: 'Unit', after: expect.objectContaining({ abbreviation: 'bdl' }),
    }));
  });

  it('rejects malformed IDs and prevents deletion of units in use', async () => {
    const invalidId = await request(app).delete('/api/units/not-an-id').set(auth);
    Product.exists.mockResolvedValueOnce({ _id: 'product' });
    const inUse = await request(app).delete(`/api/units/${unitId}`).set(auth);

    expect(invalidId.status).toBe(400);
    expect(inUse.status).toBe(409);
    expect(Unit.findByIdAndDelete).not.toHaveBeenCalled();
  });
});
