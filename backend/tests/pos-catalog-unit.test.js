const mongoose = require('mongoose');

const productId = new mongoose.Types.ObjectId();
const unitId = new mongoose.Types.ObjectId();
const outletId = new mongoose.Types.ObjectId();

jest.mock('../models', () => ({
  Product: { findOne: jest.fn(), find: jest.fn() },
  StockMovement: { aggregate: jest.fn() },
  Unit: { find: jest.fn() },
}));
jest.mock('../services/posBillService', () => ({ statusError: (m, s) => Object.assign(new Error(m), { status: s }) }));
jest.mock('../services/posCheckoutService', () => ({ resolveOutlet: jest.fn() }));

const models = require('../models');
const { resolveOutlet } = require('../services/posCheckoutService');
const { searchItems } = require('../services/posCatalogService');

describe('POS catalog base unit', () => {
  it('returns the product base unit name as packageUnitName with its piece ratio', async () => {
    const eggs = {
      _id: productId, name: 'Egg', unitId, mrp: 120, unitValue: 10, vendorPrice: 100, unitsPerPackage: 12,
    };
    models.Product.find.mockReturnValue({ sort: () => ({ limit: () => ({ lean: async () => [eggs] }) }) });
    models.Unit.find.mockReturnValue({ select: () => ({ lean: async () => [{ _id: unitId, name: 'Doz', abbreviation: 'Doz' }] }) });
    models.StockMovement.aggregate.mockResolvedValue([{ _id: productId, quantity: 5 }]);
    resolveOutlet.mockResolvedValue(outletId);

    const res = { json: jest.fn() };
    await searchItems({ query: { q: 'egg' }, user: {} }, res, jest.fn());

    const item = res.json.mock.calls[0][0].items[0];
    expect(item.packageUnitName).toBe('Doz');
    expect(item.unitsPerPackage).toBe(12);
    expect(item.unitValue).toBe(10);
  });
});
