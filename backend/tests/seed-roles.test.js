const { assertTestDatabase, ROLE_SEEDS, UNIT_SEEDS, CATEGORY_SEEDS, SETTINGS_SEED } = require('../seeders/seedRoles');

describe('default role seeder', () => {
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
});