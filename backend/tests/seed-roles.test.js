jest.mock('../models', () => ({
  Role: { bulkWrite: jest.fn(), findOne: jest.fn(), countDocuments: jest.fn() },
  User: { updateOne: jest.fn(), countDocuments: jest.fn() },
  Unit: { bulkWrite: jest.fn(), countDocuments: jest.fn() },
  Category: { bulkWrite: jest.fn(), countDocuments: jest.fn() },
  Settings: { updateOne: jest.fn(), countDocuments: jest.fn() },
  Location: { ensureCentralWarehouse: jest.fn(), countDocuments: jest.fn() },
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

  it('ensures the Central Warehouse exists when seeding', async () => {
    const counts = await seedDatabase();

    expect(Location.ensureCentralWarehouse).toHaveBeenCalledTimes(1);
    expect(Location.countDocuments).toHaveBeenCalledWith({
      type: 'CENTRAL',
      name: 'Central Warehouse',
    });
    expect(counts.locations).toBe(1);
  });
});