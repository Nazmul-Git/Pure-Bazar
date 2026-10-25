const { Location, Product, User } = require('../models');

const USER_KEYS = new Set(['createdBy', 'updatedBy', 'approvedBy', 'userId', 'cashierId', 'countedBy', 'receivedBy']);
const PRODUCT_KEYS = new Set(['productId']);
const LOCATION_KEYS = new Set(['warehouseId', 'locationId', 'outletId', 'fromLocationId', 'toLocationId']);
const OBJECT_ID = /^[a-f\d]{24}$/i;

function idString(value) {
  if (typeof value === 'string' && OBJECT_ID.test(value)) return value;
  if (value && typeof value === 'object' && value._bsontype === 'ObjectId') return value.toString();
  return null;
}

function walk(value, visit) {
  if (Array.isArray(value)) return value.forEach((item) => walk(item, visit));
  if (!value || typeof value !== 'object' || value instanceof Date || value._bsontype === 'ObjectId') return;
  Object.entries(value).forEach(([key, item]) => {
    visit(key, item);
    walk(item, visit);
  });
}

function replace(value, maps) {
  if (Array.isArray(value)) return value.map((item) => replace(item, maps));
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  if (value._bsontype === 'ObjectId') return value.toString();
  const result = {};
  Object.entries(value).forEach(([key, item]) => {
    const id = idString(item);
    if (id && USER_KEYS.has(key) && maps.users.has(id)) result[key] = maps.users.get(id);
    else if (id && PRODUCT_KEYS.has(key) && maps.products.has(id)) result[key] = maps.products.get(id);
    else if (id && LOCATION_KEYS.has(key) && maps.locations.has(id)) result[key] = maps.locations.get(id);
    else result[key] = replace(item, maps);
  });
  return result;
}

async function resolveAuditNames(logs) {
  const userIds = new Set();
  const productIds = new Set();
  const locationIds = new Set();
  logs.forEach((log) => [log.before, log.after, log.metadata].forEach((part) => walk(part, (key, item) => {
    const id = idString(item);
    if (!id) return;
    if (USER_KEYS.has(key)) userIds.add(id);
    if (PRODUCT_KEYS.has(key)) productIds.add(id);
    if (LOCATION_KEYS.has(key)) locationIds.add(id);
  })));
  const [users, products, locations] = await Promise.all([
    userIds.size ? User.find({ _id: { $in: [...userIds] } }).select('name email').lean() : [],
    productIds.size ? Product.find({ _id: { $in: [...productIds] } }).select('name').lean() : [],
    locationIds.size ? Location.find({ _id: { $in: [...locationIds] } }).select('name').lean() : [],
  ]);
  const maps = {
    users: new Map(users.map((u) => [String(u._id), u.name || u.email])),
    products: new Map(products.map((p) => [String(p._id), p.name])),
    locations: new Map(locations.map((l) => [String(l._id), l.name])),
  };
  return logs.map((log) => ({
    ...log,
    before: replace(log.before, maps),
    after: replace(log.after, maps),
    metadata: replace(log.metadata, maps),
  }));
}

module.exports = { resolveAuditNames };
