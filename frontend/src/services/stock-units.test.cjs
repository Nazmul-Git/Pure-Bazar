const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { splitQuantity, combineQuantity, formatStock, formatStockDisplay } = require('./stock-units.cjs');

describe('formatStockDisplay', () => {
  it('formats grams as Kg and Gram', () => {
    assert.equal(formatStockDisplay(1700, 'Gram'), '1 Kg 700 Gram');
    assert.equal(formatStockDisplay(2000, 'Gram'), '2 Kg');
    assert.equal(formatStockDisplay(500, 'Gram'), '500 Gram');
    assert.equal(formatStockDisplay(0, 'Gram'), '0 Gram');
    assert.equal(formatStock(1700, 1, 'Gram'), '1 Kg 700 Gram');
  });
  it('leaves other units unchanged', () => {
    assert.equal(formatStockDisplay(1700, 'Pcs'), '1700');
  });
});

describe('stock units', () => {
  it('formats fractional boxes as boxes and pieces', () => {
    assert.equal(formatStock(3.952381, 21), '3 Box(es) and 20 Pcs');
    assert.equal(formatStock(3.8, 5), '3 Box(es) and 4 Pcs');
    assert.equal(formatStock(4, 12), '4 Box(es)');
    assert.equal(formatStock(2.5, 12, 'Dozen'), '2 Dozen and 6 Pcs');
    assert.equal(formatStock(1, 12, 'Dozen'), '1 Dozen');
    assert.equal(formatStock(0.25, 4), '1 Pcs');
  });
  it('leaves single-unit products as plain numbers', () => {
    assert.equal(formatStock(7, undefined), '7');
    assert.equal(formatStock(7.5, 1), '7.5');
  });
  it('round-trips boxes and pieces', () => {
    assert.deepEqual(splitQuantity(combineQuantity(3, 200, 250), 250), { boxes: 3, pieces: 200 });
    assert.equal(combineQuantity(2, 3, 6), 2.5);
  });
});
