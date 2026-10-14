const mongoose = require('mongoose');
const models = require('../models');

const objectId = () => new mongoose.Types.ObjectId();

describe('Mongoose models', () => {
  it('registers every requested model', () => {
    expect(Object.keys(models).sort()).toEqual([
      'Brand', 'Category', 'GoodsReceive', 'PriceHistory', 'Product', 'Role', 'StockAdjustment',
      'StockCount', 'StockMovement', 'StockTransfer', 'Unit', 'User', 'WarehouseStock',
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

  it('declares requested product lookup indexes', () => {
    const indexes = models.Product.schema.indexes().map(([fields]) => fields);

    expect(indexes).toContainEqual({ barcode: 1 });
    expect(indexes).toContainEqual({ sku: 1 });
    expect(indexes).toContainEqual({ vendorId: 1 });
    expect(indexes).toContainEqual({ createdAt: 1 });
  });
});