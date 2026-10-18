jest.mock('../models', () => ({
  Role: { bulkWrite: jest.fn(), find: jest.fn(), findOne: jest.fn(), countDocuments: jest.fn() },
  User: { updateOne: jest.fn(), updateMany: jest.fn(), countDocuments: jest.fn() },
  Unit: { bulkWrite: jest.fn(), countDocuments: jest.fn() },
  Category: { bulkWrite: jest.fn(), countDocuments: jest.fn() },
  Settings: { updateOne: jest.fn(), countDocuments: jest.fn() },
  Location: {
    ensureCentralWarehouse: jest.fn(), findOneAndUpdate: jest.fn(), countDocuments: jest.fn(),
  },
}));

const { Role, User, Unit, Category, Settings, Location } = require('../models');
const {
  assertTestDatabase, ROLE_SEEDS, UNIT_SEEDS, CATEGORY_SEEDS, SETTINGS_SEED, seedDatabase,
} = require('../seeders/seedRoles');

describe('default role seeder', () => {
  const originalEnv = {
    MONGODB_URI: process.env.MONGODB_URI,
    SUPER_ADMIN_PASSWORD: process.env.SUPER_ADMIN_PASSWORD,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MONGODB_URI = 'mongodb://localhost/purebazarv1_test';
    process.env.SUPER_ADMIN_PASSWORD = 'test-password';
    Role.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: 'role-id' }) }),
    });
    Role.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ _id: 'cashier-role-id' }]),
      }),
    });
    Location.findOneAndUpdate.mockResolvedValue({ _id: 'demo-outlet-id' });
    [Role, Unit, Category, Settings, Location, User].forEach((model) => (
      model.countDocuments.mockResolvedValue(1)
    ));
  });

  afterAll(() => {
    if (originalEnv.MONGODB_URI === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = originalEnv.MONGODB_URI;
    if (originalEnv.SUPER_ADMIN_PASSWORD === undefined) delete process.env.SUPER_ADMIN_PASSWORD;
    else process.env.SUPER_ADMIN_PASSWORD = originalEnv.SUPER_ADMIN_PASSWORD;
  });

  it('only permits database names containing a test segment', () => {
    expect(assertTestDatabase('mongodb://localhost/purebazarv1_test')).toBe('purebazarv1_test');
    expect(() => assertTestDatabase('mongodb://localhost/purebazarv1')).toThrow('must include a test segment');
  });

  it('defines all roles and requested initial data', () => {
    expect(ROLE_SEEDS.map(({ name }) => name)).toEqual([
      'Super Admin', 'Inventory Manager', 'Warehouse Staff', 'Outlet Cashier', 'Finance', 'HR/Payroll',
    ]);
    expect(ROLE_SEEDS[0].permissions).toContain('*');
    expect(UNIT_SEEDS.map(({ name }) => name)).toEqual(['Kg', 'Gram', 'Ltr', 'Pcs', 'Box', 'Pack', 'Dozen']);
    expect(CATEGORY_SEEDS.length).toBeGreaterThanOrEqual(3);
    expect(SETTINGS_SEED).toMatchObject({
      shareholderDiscountPercent: 5,
      vatEnabled: false,
      commissionEnabled: false,
      vendorWalletPayoutEnabled: false,
    });
  });

  it('seeds roles without conflicting permission updates and ensures both locations', async () => {
    Location.countDocuments.mockResolvedValue(2);
    const counts = await seedDatabase();
    await seedDatabase();

    const roleOperations = Role.bulkWrite.mock.calls[0][0];
    roleOperations.forEach(({ updateOne: { update } }) => {
      const pathsByOperator = Object.values(update).flatMap((operator) => Object.keys(operator));
      expect(pathsByOperator).toHaveLength(new Set(pathsByOperator).size);
    });
    expect(roleOperations[0].updateOne.update.$addToSet.permissions.$each).toContain('*');
    expect(roleOperations[1].updateOne.update.$addToSet.permissions.$each).toContain(
      'stock:transfer:read',
    );

    expect(Role.bulkWrite).toHaveBeenCalledTimes(2);
    expect(Location.ensureCentralWarehouse).toHaveBeenCalledTimes(2);
    expect(Location.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(Location.findOneAndUpdate).toHaveBeenNthCalledWith(1,
      { type: 'OUTLET', name: 'Demo Outlet' },
      {
        $set: { isActive: true, isPrimary: true },
        $setOnInsert: { type: 'OUTLET', name: 'Demo Outlet' },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
    expect(User.updateMany).toHaveBeenCalledWith({
      roleId: { $in: ['cashier-role-id'] },
      $or: [{ locationId: { $exists: false } }, { locationId: null }],
    }, { $set: { locationId: 'demo-outlet-id' } });
    expect(Location.countDocuments).toHaveBeenCalledWith({
      $or: [
        { type: 'CENTRAL', name: 'Central Warehouse' },
        { type: 'OUTLET', name: 'Demo Outlet' },
      ],
    });
    expect(counts.locations).toBe(2);
  });
});