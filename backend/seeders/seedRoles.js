const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const {
  Role, User, Unit, Category, Settings, Location,
} = require('../models');
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const ROLE_SEEDS = [
  { name: 'Super Admin', permissions: ['*'] },
  { name: 'Inventory Manager', permissions: [
    'dashboard:read', 'products:read', 'products:write', 'categories:read', 'categories:write',
    'brands:read', 'brands:write', 'units:read', 'units:write', 'stock:read', 'stock:write',
    'warehouse:read', 'warehouse:write', 'reports:sales-stock:read',
    'stock:transfer:read', 'stock:transfer:write', 'stock:transfer:receive',
  ] },
  { name: 'Warehouse Staff', permissions: [
    'dashboard:read', 'products:read', 'stock:read', 'stock:write', 'warehouse:read', 'warehouse:write',
    'stock:transfer:read', 'stock:transfer:write',
  ] },
  { name: 'Outlet Cashier', permissions: [
    'dashboard:read', 'pos:read', 'pos:write', 'orders:read', 'orders:write',
    'returns:read', 'returns:write', 'shifts:read', 'shifts:write',
    'stock:transfer:read', 'stock:transfer:receive',
  ] },
  { name: 'Finance', permissions: [
    'dashboard:read', 'finance:read', 'finance:write', 'expenses:read', 'expenses:write',
    'vendors:read', 'vendor-payouts:read', 'vendor-payouts:write', 'shareholders:read',
    'wallet-logs:read', 'reports:read', 'auditlogs:read',
  ] },
  { name: 'HR/Payroll', permissions: [
    'dashboard:read', 'employees:read', 'employees:write', 'payroll:read', 'payroll:write',
    'salary-advances:read', 'salary-advances:write', 'expenses:read', 'expense-categories:read',
    'auditlogs:read',
  ] },
];

const UNIT_SEEDS = [
  { name: 'Kg', abbreviation: 'kg' },
  { name: 'Gram', abbreviation: 'g' },
  { name: 'Ltr', abbreviation: 'L' },
  { name: 'Pcs', abbreviation: 'pcs' },
  { name: 'Box', abbreviation: 'box' },
  { name: 'Pack', abbreviation: 'pack' },
  { name: 'Dozen', abbreviation: 'doz' },
];

const CATEGORY_SEEDS = ['Groceries', 'Beverages', 'Household', 'Personal Care'];
const SETTINGS_SEED = {
  singleton: 'global',
  shareholderDiscountPercent: 5,
  vatEnabled: false,
  defaultVatRate: 0,
  commissionEnabled: false,
  vendorWalletPayoutEnabled: false,
};

function assertTestDatabase(uri) {
  if (!uri) throw new Error('MONGODB_URI is required');
  let databaseName;
  try {
    databaseName = decodeURIComponent(new URL(uri).pathname.replace(/^\/+/, ''));
  } catch {
    throw new Error('MONGODB_URI must be a valid MongoDB URI');
  }
  if (!/(^|[_-])test(ing)?($|[_-])/i.test(databaseName)) {
    throw new Error('Refusing to seed: MONGODB_URI database name must include a test segment');
  }
  return databaseName;
}

async function seedDatabase() {
  assertTestDatabase(process.env.MONGODB_URI);
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!password) throw new Error('SUPER_ADMIN_PASSWORD is required');

  const roleOperations = ROLE_SEEDS.map((role) => {
    const update = {
      $setOnInsert: { name: role.name },
      $addToSet: { permissions: { $each: role.permissions } },
    };
    return { updateOne: { filter: { name: role.name }, update, upsert: true } };
  });
  await Role.bulkWrite(roleOperations);

  await Unit.bulkWrite(UNIT_SEEDS.map((unit) => ({
    updateOne: { filter: { name: unit.name }, update: { $setOnInsert: unit }, upsert: true },
  })));
  await Category.bulkWrite(CATEGORY_SEEDS.map((name) => ({
    updateOne: { filter: { name }, update: { $setOnInsert: { name } }, upsert: true },
  })));

  await Location.ensureCentralWarehouse();
  await Location.updateOne(
    { type: 'OUTLET', name: 'Demo Outlet' },
    { $setOnInsert: { type: 'OUTLET', name: 'Demo Outlet' } },
    { upsert: true, runValidators: true },
  );

  await Settings.updateOne(
    { singleton: 'global' },
    { $setOnInsert: SETTINGS_SEED },
    { upsert: true, runValidators: true },
  );

  const superAdminRole = await Role.findOne({ name: 'Super Admin' }).select('_id').lean();
  const passwordHash = await bcrypt.hash(password, 12);
  await User.updateOne(
    { email: (process.env.SUPER_ADMIN_EMAIL || 'admin@purebazar.local').toLowerCase() },
    {
      $set: {
        name: process.env.SUPER_ADMIN_NAME || 'Super Admin',
        email: (process.env.SUPER_ADMIN_EMAIL || 'admin@purebazar.local').toLowerCase(),
        passwordHash,
        roleId: superAdminRole._id,
        isActive: true,
      },
    },
    { upsert: true, runValidators: true },
  );

  return {
    roles: await Role.countDocuments({ name: { $in: ROLE_SEEDS.map(({ name }) => name) } }),
    units: await Unit.countDocuments({ name: { $in: UNIT_SEEDS.map(({ name }) => name) } }),
    categories: await Category.countDocuments({ name: { $in: CATEGORY_SEEDS } }),
    locations: await Location.countDocuments({
      $or: [
        { type: 'CENTRAL', name: 'Central Warehouse' },
        { type: 'OUTLET', name: 'Demo Outlet' },
      ],
    }),
    settings: await Settings.countDocuments({ singleton: 'global' }),
    users: await User.countDocuments({ email: (process.env.SUPER_ADMIN_EMAIL || 'admin@purebazar.local').toLowerCase() }),
  };
}

async function main() {
  try {
    const databaseName = assertTestDatabase(process.env.MONGODB_URI);
    await connectDB(process.env.MONGODB_URI);
    const counts = await seedDatabase();
    console.log(`Seeded database: ${databaseName}`);
    console.log(`Seeded document counts: ${JSON.stringify(counts)}`);
  } catch (error) {
    console.error(`Seeding failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }
}

if (require.main === module) main();

module.exports = {
  ROLE_SEEDS, UNIT_SEEDS, CATEGORY_SEEDS, SETTINGS_SEED, assertTestDatabase, seedDatabase,
};