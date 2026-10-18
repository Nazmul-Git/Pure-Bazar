const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createPreviewPayload,
  paymentTotalMatches,
} = require('./pos-billing-utils.cjs');

const scannedItem = {
  productId: '64b000000000000000000001',
  name: 'Tea',
  quantity: 2,
  discount: { type: 'PERCENT', value: '10', reason: ' Promotion ' },
};

test('builds a server preview payload with scanned items, discounts, and shareholder', () => {
  const payload = createPreviewPayload(
    [scannedItem],
    { type: 'FIXED', value: '1.25', reason: 'Bill offer' },
    ['CASH', 'BKASH'],
    { _id: '64b000000000000000000002' },
  );

  assert.deepEqual(payload, {
    items: [{
      productId: scannedItem.productId,
      quantity: 2,
      discount: { type: 'PERCENT', value: 10, reason: 'Promotion' },
    }],
    payments: [{ method: 'CASH' }, { method: 'BKASH' }],
    billDiscount: { type: 'FIXED', value: 1.25, reason: 'Bill offer' },
    shareholderId: '64b000000000000000000002',
  });
});

test('requires reasons for nonzero discounts and rejects percentage values over 100', () => {
  assert.throws(
    () => createPreviewPayload([{ ...scannedItem, discount: { type: 'FIXED', value: '1', reason: '' } }], null, ['CASH']),
    /reason is required/,
  );
  assert.throws(
    () => createPreviewPayload([{ ...scannedItem, discount: { type: 'PERCENT', value: '101', reason: 'Sale' } }], null, ['CASH']),
    /up to 100%/,
  );
});

test('rejects invalid quantities and wallet split tenders', () => {
  assert.throws(
    () => createPreviewPayload([{ ...scannedItem, quantity: 0 }], null, ['CASH']),
    /valid quantity/,
  );
  assert.throws(
    () => createPreviewPayload([scannedItem], null, ['WALLET', 'CASH']),
    /Wallet cannot be split/,
  );
});

test('matches split payments in rounded cents and treats wallet as full payment', () => {
  assert.equal(paymentTotalMatches(['CASH', 'CARD'], { CASH: '10.01', CARD: '8.24' }, 18.25), true);
  assert.equal(paymentTotalMatches(['CASH', 'CARD'], { CASH: '10', CARD: '8' }, 18.25), false);
  assert.equal(paymentTotalMatches(['CASH', 'CARD'], { CASH: '18.25', CARD: '0' }, 18.25), false);
  assert.equal(paymentTotalMatches(['WALLET'], {}, 18.25), true);
  assert.equal(paymentTotalMatches([], {}, 0), false);
});
