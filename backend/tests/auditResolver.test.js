jest.mock('../models', () => ({
  User: { find: jest.fn() },
  Product: { find: jest.fn() },
  Location: { find: jest.fn(() => mockChain([])) },
}));

const { Product, User } = require('../models');
const { resolveAuditNames } = require('../services/auditResolver');

const mockChain = (rows) => ({ select: () => ({ lean: async () => rows }) });

describe('resolveAuditNames', () => {
  it('replaces user and product ids with names', async () => {
    const userId = '65b000000000000000000001';
    const productId = '65b000000000000000000009';
    User.find.mockReturnValue(mockChain([{ _id: userId, name: 'Rahim' }]));
    Product.find.mockReturnValue(mockChain([{ _id: productId, name: 'Rice 5kg' }]));
    const [log] = await resolveAuditNames([{
      after: { createdBy: userId, lines: [{ productId, countedQuantity: 3 }] },
    }]);
    expect(log.after.createdBy).toBe('Rahim');
    expect(log.after.lines[0].productId).toBe('Rice 5kg');
    expect(log.after.lines[0].countedQuantity).toBe(3);
  });
});
