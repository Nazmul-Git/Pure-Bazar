const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { Role } = require('../models');

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const ROLE_MODULE_ADDITIONS = {
  'Inventory Manager': ['reports:read'],
  Finance: ['shareholders:read', 'reports:read'],
  'HR/Payroll': ['employees:read', 'employees:write'],
};

function prepareRolePermissionUpdates(roles) {
  return roles.flatMap((role) => {
    const permissions = new Set(role.permissions || []);
    const required = [
      'dashboard:read',
      ...(ROLE_MODULE_ADDITIONS[role.name] || []),
    ];
    const additions = required.filter((permission) => !permissions.has(permission));
    if (!additions.length) return [];

    return [{
      updateOne: {
        filter: { _id: role._id },
        update: { $addToSet: { permissions: { $each: additions } } },
      },
    }];
  });
}

async function migrateRolePermissions() {
  const roles = await Role.find().select('_id name permissions').lean();
  const operations = prepareRolePermissionUpdates(roles);
  if (!operations.length) return { scanned: roles.length, updated: 0 };

  const result = await Role.bulkWrite(operations, { ordered: true, runValidators: true });
  return { scanned: roles.length, updated: result.modifiedCount };
}

async function main() {
  if (!process.argv.includes('--apply')) {
    throw new Error('Pass --apply to add missing module permissions to roles in the configured database');
  }
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');

  await connectDB(process.env.MONGODB_URI);
  const result = await migrateRolePermissions();
  console.log(`Role permission migration complete: ${JSON.stringify(result)}`);
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(`Role permission migration failed: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    });
}

module.exports = { ROLE_MODULE_ADDITIONS, prepareRolePermissionUpdates, migrateRolePermissions };
