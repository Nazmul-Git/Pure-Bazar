const mongoose = require('mongoose');
const { Product, StockMovement } = require('../models');

function statusError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function canManageLocation(user, locationId) {
  if (['Super Admin', 'Inventory Manager'].includes(user.role)) return true;
  return user.role === 'Warehouse Staff'
    && user.locationId?.toString() === locationId.toString();
}

function adjustmentValue(lines, products) {
  let cents = 0;
  for (const line of lines) {
    const product = products.get(line.productId.toString());
    cents += Math.round((Math.abs(line.quantity) * product.vendorPrice + Number.EPSILON) * 100);
  }
  return cents / 100;
}

async function loadProducts(productIds, session) {
  const products = await Product.find({ _id: { $in: productIds } })
    .select('_id name barcode vendorPrice')
    .session(session)
    .lean();
  if (products.length !== productIds.length) throw statusError('One or more products were not found', 400);
  return new Map(products.map((product) => [product._id.toString(), product]));
}

async function currentStock(warehouseId, productIds, session) {
  const stock = await StockMovement.aggregate([
    {
      $match: {
        warehouseId: new mongoose.Types.ObjectId(warehouseId),
        productId: { $in: productIds.map((productId) => new mongoose.Types.ObjectId(productId)) },
      },
    },
    { $group: { _id: '$productId', quantity: { $sum: '$quantity' } } },
  ]).session(session);
  return new Map(stock.map(({ _id, quantity }) => [_id.toString(), quantity]));
}

async function postMovements(adjustment, actorId, session) {
  const balances = await currentStock(
    adjustment.warehouseId,
    adjustment.lines.map((line) => line.productId),
    session,
  );
  for (const line of adjustment.lines) {
    if ((balances.get(line.productId.toString()) || 0) + line.quantity < -0.000000001) {
      throw statusError('An adjustment cannot reduce stock below zero', 409);
    }
  }
  await StockMovement.create(adjustment.lines.map((line) => ({
    productId: line.productId,
    warehouseId: adjustment.warehouseId,
    quantity: line.quantity,
    type: 'ADJUSTMENT',
    userId: actorId,
    reason: adjustment.reason,
    referenceId: adjustment._id,
    referenceType: 'StockAdjustment',
  })), { session });
}

function objectOf(document) {
  return document.toObject ? document.toObject() : document;
}

module.exports = {
  statusError, canManageLocation, adjustmentValue, loadProducts, currentStock, postMovements, objectOf,
};
