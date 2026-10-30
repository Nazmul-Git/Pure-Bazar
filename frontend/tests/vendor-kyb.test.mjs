import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { emptyKybForm, validateKybForm, buildKybPayload } = createRequire(import.meta.url)('../src/services/vendor-kyb.cjs');

const filled = {
  ...emptyKybForm,
  companyName: 'Acme',
  tradeLicenseNo: 'TL-1',
  tradeLicenseExpiry: '2099-01-01',
  businessType: 'Partnership',
  fullNameEng: 'Rahim',
  nidNumber: '1234567890',
  warehouseAddress: 'Dhaka',
  primaryContactPerson: 'Karim',
  dispatchMobile: '01711111111',
  productCategories: 'Grocery, Snacks, ',
};

test('empty form reports every mandatory KYB field', () => {
  const errors = validateKybForm(emptyKybForm, {});
  for (const key of ['tradeLicenseNo', 'nidNumber', 'warehouseAddress', 'tradeLicense', 'ownerNid', 'dispatchMobile']) {
    assert.ok(errors[key], key);
  }
});

test('complete form with both documents is valid', () => {
  assert.deepEqual(validateKybForm(filled, { tradeLicense: {}, ownerNid: {} }), {});
});

test('missing documents or short NID are caught', () => {
  const errors = validateKybForm({ ...filled, nidNumber: '123' }, { tradeLicense: {} });
  assert.ok(errors.nidNumber);
  assert.ok(errors.ownerNid);
  assert.equal(errors.tradeLicense, undefined);
});

test('expired license is rejected and payload splits categories', () => {
  assert.ok(validateKybForm({ ...filled, tradeLicenseExpiry: '2000-01-01' }, { tradeLicense: {}, ownerNid: {} }).tradeLicenseExpiry);
  assert.deepEqual(buildKybPayload(filled).operationalAndWarehouseLogistics.productCategories, ['Grocery', 'Snacks']);
});
