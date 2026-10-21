const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  filterPayoutRows,
  idString,
  makePaymentPayload,
} = require('./vendor-payout-utils');

describe('vendor payout utilities', () => {
  it('filters open statements by status and vendor', () => {
    const rows = [
      { status: 'Draft', vendor: { id: 'vendor-1' } },
      { status: 'Approved', vendor: { id: 'vendor-1' } },
      { status: 'Approved', vendor: { id: 'vendor-2' } },
    ];

    assert.deepEqual(filterPayoutRows(rows, 'Approved', 'vendor-1'), [rows[1]]);
    assert.deepEqual(filterPayoutRows(rows, '', ''), rows);
  });

  it('submits the required payment fields including receiver name', () => {
    assert.deepEqual(makePaymentPayload({
      paymentMethod: 'Bank',
      paymentReference: '  TRX-125  ',
      paidAt: '2026-10-22',
      receiverName: '  Vendor Rep  ',
    }), {
      status: 'Paid',
      paymentMethod: 'Bank',
      paymentReference: 'TRX-125',
      paidAt: '2026-10-22',
      receiverName: 'Vendor Rep',
    });
  });

  it('normalizes populated and scalar vendor ids for history filters', () => {
    assert.equal(idString('vendor-1'), 'vendor-1');
    assert.equal(idString({ _id: 'vendor-2' }), 'vendor-2');
  });
});
