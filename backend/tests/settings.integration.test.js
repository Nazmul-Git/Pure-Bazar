const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');

jest.mock('../models', () => ({
  AuditLog: { create: jest.fn(), find: jest.fn() },
  Settings: Object.assign(jest.fn(() => ({
    toObject: () => ({
      shareholderDiscountPercent: 5,
      vatEnabled: false,
      defaultVatRate: 0,
      vatPriceMode: 'EXCLUDED',
      vatCalculationOrder: 'DISCOUNT_THEN_VAT',
      discountLimitByRole: {},
      enabledPaymentMethods: ['Cash', 'Bank', 'bKash', 'Nagad'],
      receiptLayout: {},
      vendorTerms: [],
      probashiStatus: 'NotConfigured',
      vendorSettlementCyclePerMonth: 1,
      vendorPayoutCutoffDates: [],
      enabledVendorPayoutMethods: ['Cash', 'Bank', 'bKash', 'Nagad'],
      commissionEnabled: false,
      vendorWalletPayoutEnabled: false,
      outlets: [],
    }),
  })), { findOne: jest.fn(), findOneAndUpdate: jest.fn() }),
  User: { findById: jest.fn() },
}));

const { AuditLog, Settings, User } = require('../models');
const settingsRoutes = require('../routes/settingsRoutes');
const errorMiddleware = require('../middlewares/errorMiddleware');

const secret = 'settings-integration-test-secret-value';
const adminId = '65b000000000000000000001';
const settingsId = '65b000000000000000000002';
const adminRoleId = '65b000000000000000000003';
const admin = {
  _id: { toString: () => adminId },
  name: 'Admin User',
  email: 'admin@example.test',
  isActive: true,
  roleId: { _id: adminRoleId, name: 'Super Admin', permissions: ['*'] },
};

function chain(value) {
  return {
    lean: () => Promise.resolve(value),
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
}

function settingsDocument(fields = {}) {
  const data = {
    _id: settingsId,
    shareholderDiscountPercent: 5,
    vatEnabled: false,
    defaultVatRate: 0,
    vatPriceMode: 'EXCLUDED',
    vatCalculationOrder: 'DISCOUNT_THEN_VAT',
    discountLimitByRole: new Map(),
    enabledPaymentMethods: ['Cash', 'Bank', 'bKash', 'Nagad'],
    receiptLayout: {},
    vendorTerms: [],
    probashiStatus: 'NotConfigured',
    vendorSettlementCyclePerMonth: 1,
    vendorPayoutCutoffDates: [],
    enabledVendorPayoutMethods: ['Cash', 'Bank', 'bKash', 'Nagad'],
    commissionEnabled: false,
    vendorWalletPayoutEnabled: false,
    outlets: [],
    ...fields,
  };
  return { ...data, toObject: () => ({ ...data, discountLimitByRole: Object.fromEntries(data.discountLimitByRole) }) };
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', settingsRoutes);
  app.use(errorMiddleware);
  return app;
}

function tokenFor(id = adminId) {
  return jwt.sign({ sub: id }, secret, { expiresIn: '1h' });
}

describe('settings and audit endpoints', () => {
  const app = createApp();
  const auth = { Authorization: `Bearer ${tokenFor()}` };
  const baseSettings = settingsDocument();

  beforeEach(() => {
    process.env.JWT_SECRET = secret;
    jest.clearAllMocks();
    User.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(admin) });
    Settings.findOne.mockReturnValue(chain(baseSettings));
    Settings.findOneAndUpdate.mockResolvedValue(baseSettings);
    AuditLog.create.mockResolvedValue({});
    AuditLog.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });
  });

  it('returns defaults and protects settings from unauthenticated or non-admin access', async () => {
    Settings.findOne.mockReturnValue(chain(null));
    const defaults = await request(app).get('/api/settings').set(auth);
    const unauthenticated = await request(app).get('/api/settings');
    User.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        ...admin,
        roleId: { name: 'Cashier', permissions: ['*'] },
      }),
    });
    const forbidden = await request(app).get('/api/settings').set(auth);

    expect(defaults.status).toBe(200);
    expect(defaults.body.settings).toMatchObject({
      shareholderDiscountPercent: 5,
      vatEnabled: false,
      commissionEnabled: false,
      vendorWalletPayoutEnabled: false,
    });
    expect(defaults.body.settings.probashiStatus).toBe('NotConfigured');
    expect(unauthenticated.status).toBe(401);
    expect(forbidden.status).toBe(403);
  });

  it('validates settings, appends vendor term versions, and audits each update', async () => {
    const current = settingsDocument({
      vendorTerms: [{ version: '1', terms: 'Original terms', effectiveFrom: new Date('2026-01-01') }],
    });
    Settings.findOne.mockReturnValue(chain(current));
    const updated = settingsDocument({
      vatEnabled: true,
      vendorTerms: [
        { version: '1', terms: 'Original terms', effectiveFrom: new Date('2026-01-01') },
        { version: '2', terms: 'Updated terms', effectiveFrom: new Date('2026-10-01') },
      ],
    });
    Settings.findOneAndUpdate.mockResolvedValue(updated);

    const response = await request(app).put('/api/settings').set(auth).send({
      vatEnabled: true,
      vendorTerms: [
        { version: '1', terms: 'Original terms', effectiveFrom: '2026-01-01T00:00:00.000Z' },
        { version: '2', terms: 'Updated terms', effectiveFrom: '2026-10-01T00:00:00.000Z' },
      ],
    });
    const invalid = await request(app).put('/api/settings').set(auth).send({ commissionEnabled: true, extra: true });

    expect(response.status).toBe(200);
    expect(Settings.findOneAndUpdate).toHaveBeenCalledWith(
      { singleton: 'global' },
      { $set: expect.objectContaining({ vatEnabled: true }) },
      expect.objectContaining({ upsert: true, runValidators: true }),
    );
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      actorId: admin._id,
      action: 'UPDATE',
      entity: 'Settings',
      before: expect.any(Object),
      after: expect.objectContaining({ vatEnabled: true }),
    }));
    expect(invalid.status).toBe(400);
    expect(AuditLog.create).toHaveBeenCalledTimes(1);
  });

  it('rejects modified vendor terms and cut-off dates inconsistent with the cycle', async () => {
    Settings.findOne.mockReturnValue(chain(settingsDocument({
      vendorTerms: [{ version: '1', terms: 'Original terms', effectiveFrom: new Date('2026-01-01') }],
    })));
    const changedTerms = await request(app).put('/api/settings').set(auth).send({
      vendorTerms: [{ version: '1', terms: 'Changed terms', effectiveFrom: '2026-01-01' }],
    });
    const badCutoffs = await request(app).put('/api/settings').set(auth).send({
      vendorSettlementCyclePerMonth: 2,
      vendorPayoutCutoffDates: [15],
    });

    expect(changedTerms.status).toBe(400);
    expect(badCutoffs.status).toBe(400);
    expect(Settings.findOneAndUpdate).not.toHaveBeenCalled();
    expect(AuditLog.create).not.toHaveBeenCalled();
  });

  it('filters audit events by actor, action/entity, and date range', async () => {
    const response = await request(app).get(
      `/api/audit-logs?who=${adminId}&what=Settings&from=2026-10-01&to=2026-10-31`,
    ).set(auth);

    expect(response.status).toBe(200);
    expect(AuditLog.find).toHaveBeenCalledWith({
      actorId: adminId,
      $or: [{ action: 'Settings' }, { entity: 'Settings' }],
      createdAt: {
        $gte: new Date('2026-10-01'),
        $lte: new Date('2026-10-31T23:59:59.999Z'),
      },
    });
    expect(AuditLog.find.mock.results[0].value.limit).toHaveBeenCalledWith(100);
  });

  it('rejects invalid audit filters', async () => {
    const response = await request(app).get('/api/audit-logs?who=not-an-id&from=tomorrow').set(auth);

    expect(response.status).toBe(400);
    expect(AuditLog.find).not.toHaveBeenCalled();
  });
});
