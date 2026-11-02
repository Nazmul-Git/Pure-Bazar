const {
  availableStock, clampQuantity, hasStockProblem, lineTotal, unitPrice,
} = require('../../frontend/src/services/pos-cart-utils.cjs');
const { getCode39Runs } = require('../../frontend/src/services/code39.cjs');

describe('Code 39 receipt barcode', () => {
  it('encodes an order number with start/stop characters', () => {
    const runs = getCode39Runs('POS-123');
    expect(runs.filter((run) => run.bar).length).toBe(5 * 9);
    expect(() => getCode39Runs('a b')).toThrow();
  });
});

describe('POS cart quantity rules', () => {
  it('never lets quantity reach 0, 0.01 or negative values', () => {
    [0, 0.01, -3, '', 'abc', NaN, null].forEach((value) => {
      expect(clampQuantity(value, 10).quantity).toBe(1);
    });
  });

  it('truncates decimals to whole units', () => {
    expect(clampQuantity(2.9, 10)).toEqual({ quantity: 2, limited: false });
  });

  it('caps quantity at available stock', () => {
    expect(clampQuantity(8, 5)).toEqual({ quantity: 5, limited: true });
    expect(clampQuantity(5, 5)).toEqual({ quantity: 5, limited: false });
  });

  it('flags stock-out and over-stock lines', () => {
    expect(hasStockProblem([{ stock: 0, quantity: 1 }])).toBe(true);
    expect(hasStockProblem([{ stock: 2, quantity: 3 }])).toBe(true);
    expect(hasStockProblem([{ stock: 2, quantity: 2 }])).toBe(false);
  });

  it('uses piece stock and price for Toffen Tablet sold by the piece', () => {
    const toffen = {
      stock: 2.5, mrp: 2100, unitsPerPackage: 210, subUnitPrice: 10, unit: 'PIECE', quantity: 525,
    };
    expect(availableStock(toffen)).toBe(525);
    expect(unitPrice(toffen)).toBe(10);
    expect(lineTotal({ ...toffen, quantity: 3 })).toBe(30);
    expect(hasStockProblem([toffen])).toBe(false);
    expect(hasStockProblem([{ ...toffen, quantity: 526 }])).toBe(true);
    expect(availableStock({ ...toffen, unit: 'PACKAGE' })).toBe(2);
    expect(lineTotal({ ...toffen, unit: 'PACKAGE', quantity: 1 })).toBe(2100);
  });

  it('shows base pieces for Pcs and floor(totalPcs / unitSize) for Box without re-multiplying', () => {
    const item = { stock: 5, unitsPerPackage: 100, subUnitPrice: 1 };
    expect(availableStock({ ...item, unit: 'PIECE' })).toBe(500);
    expect(availableStock({ ...item, unit: 'PACKAGE' })).toBe(5);
    expect(availableStock({ ...item, stock: 4.9999999999, unit: 'PACKAGE' })).toBe(5);
    expect(availableStock({ ...item, stock: 5.5, unit: 'PACKAGE' })).toBe(5);
  });

  it('calculates package and piece totals from total MRP', () => {
    const product = {
      mrp: 1557, unitValue: 10, unitsPerPackage: 120, subUnitPrice: 12.98,
    };
    expect(unitPrice({ ...product, unit: 'PACKAGE' })).toBe(155.7);
    expect(lineTotal({ ...product, unit: 'PACKAGE', quantity: 1 })).toBe(155.7);
    expect(unitPrice({ ...product, unit: 'PIECE' })).toBe(12.98);
    expect(lineTotal({ ...product, unit: 'PIECE', quantity: 1 })).toBe(12.98);
  });
});
