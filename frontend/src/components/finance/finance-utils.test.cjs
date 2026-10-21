const test = require('node:test');
const assert = require('node:assert/strict');
const { sumMoneyCents } = require('./finance-utils.js');

test('sums payout amounts in integer cents', () => {
  assert.equal(sumMoneyCents([{ payable: 12.34 }, { payable: 0.1 }, { payable: 0.2 }], 'payable'), 1264);
});
