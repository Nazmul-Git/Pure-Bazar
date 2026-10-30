const express = require('express');
const request = require('supertest');

jest.mock('../models', () => ({
  AuditLog: { create: jest.fn().mockResolvedValue({}) },
  VendorRegistration: { create: jest.fn() },
}));
jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return { ...actual, promises: { ...actual.promises, mkdir: jest.fn().mockResolvedValue(), writeFile: jest.fn().mockResolvedValue() } };
});

const { AuditLog, VendorRegistration } = require('../models');
const { validateVendorKyb } = require('../utils/vendorKybValidation');
const { vendorKybUpload } = require('../middlewares/vendorKybUpload');
const controller = require('../controllers/vendorRegistrationController');
const errorMiddleware = require('../middlewares/errorMiddleware');

const valid = {
  businessLegalIdentity: {
    companyName: 'Acme Traders',
    tradeLicenseNo: 'TL-123',
    tradeLicenseExpiry: '2099-01-01',
    businessType: 'Partnership',
    ownerInfo: { fullNameEng: 'Rahim Uddin', nidNumber: '1234567890' },
  },
  operationalAndWarehouseLogistics: {
    warehouseAddress: 'Plot 5, Dhaka',
    primaryContactPerson: 'Karim',
    dispatchMobile: '01711111111',
    productCategories: ['Grocery'],
    deliveryLeadTimeHours: 24,
  },
};
const pdf = Buffer.from('%PDF-1.4 test');

function app() {
  const server = express();
  server.use((req, res, next) => { req.user = { _id: '65b000000000000000000001' }; next(); });
  server.post('/register', vendorKybUpload, controller.register);
  server.use(errorMiddleware);
  return server;
}

describe('vendor KYB validation', () => {
  it('accepts a complete registration', () => {
    expect(validateVendorKyb(valid, { tradeLicense: {}, ownerNid: {} })).toEqual([]);
  });

  it('flags missing trade license, NID and warehouse address', () => {
    const bad = JSON.parse(JSON.stringify(valid));
    delete bad.businessLegalIdentity.tradeLicenseNo;
    bad.businessLegalIdentity.ownerInfo.nidNumber = '';
    bad.operationalAndWarehouseLogistics.warehouseAddress = ' ';
    const fields = validateVendorKyb(bad, {}).map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining([
      'businessLegalIdentity.tradeLicenseNo',
      'businessLegalIdentity.ownerInfo.nidNumber',
      'operationalAndWarehouseLogistics.warehouseAddress',
      'tradeLicense',
      'ownerNid',
    ]));
  });
});

describe('POST register', () => {
  beforeEach(() => VendorRegistration.create.mockReset());

  it('rejects submissions without documents', async () => {
    const res = await request(app()).post('/register').field('data', JSON.stringify(valid));
    expect(res.status).toBe(400);
    expect(res.body.errors.map((e) => e.field)).toEqual(expect.arrayContaining(['tradeLicense', 'ownerNid']));
    expect(VendorRegistration.create).not.toHaveBeenCalled();
  });

  it('rejects files whose content does not match the type', async () => {
    const res = await request(app()).post('/register').field('data', JSON.stringify(valid))
      .attach('tradeLicense', Buffer.from('not a pdf'), { filename: 'a.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(400);
  });

  it('creates a PENDING registration and audits it', async () => {
    VendorRegistration.create.mockImplementation(async (doc) => ({
      ...doc, _id: '65b000000000000000000009', verificationStatus: 'PENDING',
    }));
    const res = await request(app()).post('/register').field('data', JSON.stringify(valid))
      .attach('tradeLicense', pdf, { filename: 'tl.pdf', contentType: 'application/pdf' })
      .attach('ownerNid', pdf, { filename: 'nid.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(201);
    expect(res.body.registration.documents.tradeLicense.fileName).toMatch(/\.pdf$/);
    expect(VendorRegistration.create.mock.calls[0][0].businessLegalIdentity.tradeLicenseExpiry).toBeInstanceOf(Date);
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'VENDOR_KYB_SUBMITTED' }));
  });
});
