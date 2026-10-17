const mongoose = require('mongoose');
const models = require('../models');

const objectId = () => new mongoose.Types.ObjectId();

describe('Mongoose models', () => {
  it('registers every requested model', () => {
    expect(Object.keys(models).sort()).toEqual([
      'AuditLog', 'Brand', 'Category', 'DiscountLog', 'Employee', 'Expense', 'ExpenseCategory',
      'GoodsReceive', 'Location', 'Order', 'PriceHistory', 'Product', 'Return', 'Role', 'SalaryAdvance',
      'SalarySheet', 'Settings', 'Shareholder', 'Shift', 'StockAdjustment', 'StockCount',
      'StockMovement', 'StockTransfer', 'Unit', 'User', 'Vendor', 'VendorLedger',
      'VendorStatement', 'WalletAuditLog', 'WalletLog',
    ]);
  });

  it('rejects an MRP below vendor price', async () => {
    const product = new models.Product({
      name: 'Rice',
      categoryId: objectId(),
      unitId: objectId(),
      ownerType: 'COMPANY',
      vendorPrice: 100,
      mrp: 99,
    });

    await expect(product.validate()).rejects.toMatchObject({
      errors: { mrp: expect.objectContaining({ message: expect.stringContaining('greater than or equal') }) },
    });
  });

  it('calculates margin and applies stock and commission defaults', async () => {
    const product = new models.Product({
      name: 'Rice',
      categoryId: objectId(),
      unitId: objectId(),
      ownerType: 'COMPANY',
      vendorPrice: 99.99,
      mrp: 120,
    });
    const category = new models.Category({ name: 'Food' });

    await product.validate();
    await category.validate();

    expect(product.margin).toBe(20.01);
    expect(product.listedOnline).toBe(false);
    expect(category.commissionEnabled).toBe(false);
  });

  it('generates a valid EAN-13 barcode and enforces uniqueness', async () => {
    const product = new models.Product({
      name: 'Rice',
      categoryId: objectId(),
      unitId: objectId(),
      ownerType: 'COMPANY',
      vendorPrice: 99,
      mrp: 120,
    });

    await product.validate();

    expect(product.barcode).toMatch(/^\d{13}$/);
    const weightedBody = [...product.barcode.slice(0, 12)].reduce((sum, digit, index) => (
      sum + Number(digit) * (index % 2 === 0 ? 1 : 3)
    ), 0);
    expect((weightedBody + Number(product.barcode[12])) % 10).toBe(0);
    expect(models.Product.schema.indexes().some(([fields, options]) => (
      fields.barcode === 1 && options.unique
    ))).toBe(true);
  });

  it('rejects barcodes with an invalid EAN-13 check digit', async () => {
    const product = new models.Product({
      name: 'Rice',
      categoryId: objectId(),
      unitId: objectId(),
      ownerType: 'COMPANY',
      vendorPrice: 99,
      mrp: 120,
      barcode: '4006381333932',
    });

    await expect(product.validate()).rejects.toMatchObject({
      errors: { barcode: expect.objectContaining({ message: 'Barcode must be a valid EAN-13 number' }) },
    });
  });

  it('requires a reason for stock adjustments', async () => {
    const adjustment = new models.StockAdjustment({
      warehouseId: objectId(),
      createdBy: objectId(),
      lines: [{ productId: objectId(), quantity: 1 }],
    });

    await expect(adjustment.validate()).rejects.toMatchObject({
      errors: { reason: expect.objectContaining({ kind: 'required' }) },
    });
  });

  it('requires signed nonzero movement quantities and unique products per GRN', async () => {
    const outgoing = new models.StockMovement({
      productId: objectId(), warehouseId: objectId(), quantity: 2, type: 'SALE', userId: objectId(),
    });
    const grn = new models.GoodsReceive({
      ownerType: 'COMPANY',
      warehouseId: objectId(),
      createdBy: objectId(),
      lines: [
        { productId: objectId(), receivedQuantity: 1, acceptedQuantity: 1, rejectedQuantity: 0 },
        { productId: objectId(), receivedQuantity: 1, acceptedQuantity: 1, rejectedQuantity: 0 },
      ],
    });
    grn.lines[1].productId = grn.lines[0].productId;

    await expect(outgoing.validate()).rejects.toMatchObject({
      errors: { quantity: expect.objectContaining({ message: 'Outgoing movements must have a negative quantity' }) },
    });
    await expect(grn.validate()).rejects.toMatchObject({
      errors: { lines: expect.objectContaining({ message: 'A product can only appear once on a goods receive' }) },
    });
  });

  it('restricts locations to central warehouses or outlets and requires a name', async () => {
    const central = new models.Location({ type: 'CENTRAL', name: 'Central Warehouse' });
    const invalid = new models.Location({ type: 'WAREHOUSE', name: '' });

    await expect(central.validate()).resolves.toBeUndefined();
    await expect(invalid.validate()).rejects.toMatchObject({
      errors: {
        type: expect.objectContaining({ kind: 'enum' }),
        name: expect.objectContaining({ kind: 'required' }),
      },
    });
  });

  it('declares requested product lookup indexes', () => {
    const indexes = models.Product.schema.indexes().map(([fields]) => fields);

    expect(indexes).toContainEqual({ barcode: 1 });
    expect(indexes).toContainEqual({ vendorId: 1 });
    expect(indexes).toContainEqual({ createdAt: 1 });
    expect(models.Product.schema.path('sku')).toBeUndefined();
    expect(indexes.some((fields) => fields.sku)).toBe(false);
  });
});