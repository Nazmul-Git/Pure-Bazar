const {
  calculateSubUnitPrice, effectiveSubUnitPrice, linePricing, packageUnitPrice,
} = require('../utils/piecePricing');
const { calculateBill } = require('../services/billEngine');
const { Product } = require('../models');

describe('margin-safe piece pricing', () => {
  it('rounds the piece price up to the next cent', () => {
    expect(calculateSubUnitPrice(1000, 30)).toBe(33.34);
    expect(calculateSubUnitPrice(100, 4)).toBe(25);
    expect(calculateSubUnitPrice(10, 3)).toBe(3.34);
    expect(calculateSubUnitPrice(100, 0)).toBeNull();
  });

  it('prefers a manager override over the automatic price', () => {
    const product = { mrp: 1000, unitsPerPackage: 30 };
    expect(effectiveSubUnitPrice(product)).toBe(33.34);
    expect(effectiveSubUnitPrice({ ...product, subUnitPriceOverride: 35 })).toBe(35);
    expect(effectiveSubUnitPrice({ mrp: 1000 })).toBeNull();
  });

  it('stores the piece price on the product and rejects overrides below it', async () => {
    const base = {
      name: 'Box', categoryId: '507f1f77bcf86cd799439011', unitId: '507f1f77bcf86cd799439012',
      ownerType: 'COMPANY', vendorPrice: 800, mrp: 1000, unitsPerPackage: 30,
    };
    const product = new Product(base);
    await product.validate();
    expect(product.subUnitPrice).toBe(33.34);
    const low = new Product({ ...base, subUnitPriceOverride: 33 });
    await expect(low.validate()).rejects.toThrow(/margin-safe/);
    const custom = new Product({ ...base, subUnitPriceOverride: 36 });
    await custom.validate();
    expect(custom.subUnitPrice).toBe(36);
  });

  it('selling all 30 pieces of a BDT 1000 box totals at least BDT 1000', () => {
    const product = { mrp: 1000, vendorPrice: 800, unitsPerPackage: 30 };
    const pricing = linePricing(product, { unit: 'PIECE', quantity: 30 });
    expect(pricing.stockQuantity).toBe(1);
    const bill = calculateBill({
      items: [{
        productId: 'p1', ownerType: 'COMPANY', quantity: 30, mrp: pricing.unitPrice, vendorPrice: pricing.unitVendorPrice,
      }],
      paymentMethod: 'CASH',
    });
    expect(bill.subtotal).toBe(1000.2);
    expect(bill.grandTotal).toBeGreaterThanOrEqual(1000);
  });

  it('prices a primary package from total MRP and derives piece price from total pieces', () => {
    const product = {
      mrp: 1557, vendorPrice: 1200, unitValue: 10, unitsPerPackage: 120,
    };

    expect(packageUnitPrice(product)).toBe(155.7);
    expect(linePricing(product, { unit: 'PACKAGE', quantity: 1 })).toMatchObject({
      unitPrice: 155.7,
      unitVendorPrice: 120,
    });
    expect(linePricing(product, { unit: 'PIECE', quantity: 1 })).toMatchObject({
      unitPrice: 12.98,
      unitVendorPrice: 10,
    });
    expect(linePricing({ ...product, subUnitPriceOverride: 14.25 }, { unit: 'PIECE', quantity: 1 }).unitPrice).toBe(14.25);
  });
});
