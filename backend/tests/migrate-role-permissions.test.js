jest.mock('../models', () => ({
  Role: { find: jest.fn(), bulkWrite: jest.fn() },
}));

const { Role } = require('../models');
const { prepareRolePermissionUpdates, migrateRolePermissions } = require('../scripts/migrateRolePermissions');

describe('role permission migration', () => {
  beforeEach(() => jest.clearAllMocks());

  it('adds only missing module permissions and preserves existing role grants', () => {
    const updates = prepareRolePermissionUpdates([
      { _id: 'custom', name: 'Custom', permissions: ['products:read'] },
      { _id: 'inventory', name: 'Inventory Manager', permissions: ['dashboard:read'] },
      { _id: 'finance', name: 'Finance', permissions: ['dashboard:read', 'shareholders:read'] },
      { _id: 'hr', name: 'HR/Payroll', permissions: ['dashboard:read', 'employees:read'] },
    ]);

    expect(updates).toEqual([
      {
        updateOne: {
          filter: { _id: 'custom' },
          update: { $addToSet: { permissions: { $each: ['dashboard:read'] } } },
        },
      },
      {
        updateOne: {
          filter: { _id: 'inventory' },
          update: { $addToSet: { permissions: { $each: ['reports:read'] } } },
        },
      },
      {
        updateOne: {
          filter: { _id: 'finance' },
          update: { $addToSet: { permissions: { $each: ['reports:read'] } } },
        },
      },
      {
        updateOne: {
          filter: { _id: 'hr' },
          update: { $addToSet: { permissions: { $each: ['employees:write'] } } },
        },
      },
    ]);
  });

  it('does not write when every role already has its module permissions', async () => {
    const roles = [{
      _id: 'finance',
      name: 'Finance',
      permissions: ['dashboard:read', 'shareholders:read', 'reports:read'],
    }];
    Role.find.mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(roles) }),
    });

    await expect(migrateRolePermissions()).resolves.toEqual({ scanned: 1, updated: 0 });
    expect(Role.bulkWrite).not.toHaveBeenCalled();
  });
});
