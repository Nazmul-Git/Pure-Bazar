const mongoose = require('mongoose');
const {
  AuditLog, Location, Product, StockMovement, StockTransfer,
} = require('../models');

function statusError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function elevated(user) {
  return ['Super Admin', 'Inventory Manager'].includes(user.role);
}

function assignedLocation(user) {
  if (!user.locationId) throw statusError('A location must be assigned to this user', 403);
  return user.locationId.toString();
}

function locationFilter(user) {
  if (elevated(user)) return {};
  if (user.role === 'Warehouse Staff') return { fromWarehouseId: assignedLocation(user) };
  if (user.role === 'Outlet Cashier') return { toWarehouseId: assignedLocation(user) };
  throw statusError('Insufficient role permissions', 403);
}

function canManageSource(user, locationId) {
  return elevated(user)
    || (user.role === 'Warehouse Staff' && assignedLocation(user) === locationId.toString());
}

function canReceive(user, locationId) {
  return elevated(user)
    || (user.role === 'Outlet Cashier' && assignedLocation(user) === locationId.toString());
}

function normalizeRequestedLines(lines) {
  const combined = new Map();
  for (const line of lines) {
    const productId = line.productId.toString();
    combined.set(productId, (combined.get(productId) || 0) + Number(line.requestedQuantity));
  }
  return [...combined].map(([productId, requestedQuantity]) => ({ productId, requestedQuantity }));
}

function transferOutput(transfer) {
  const data = transfer.toObject ? transfer.toObject() : transfer;
  return {
    id: data._id.toString(),
    fromWarehouseId: data.fromWarehouseId.toString(),
    toWarehouseId: data.toWarehouseId.toString(),
    status: data.status,
    createdBy: data.createdBy?.toString(),
    dispatchedBy: data.dispatchedBy?.toString() || null,
    receivedBy: data.receivedBy?.toString() || null,
    dispatchedAt: data.dispatchedAt || null,
    receivedAt: data.receivedAt || null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    lines: data.lines.map((line) => ({
      productId: line.productId.toString(),
      requestedQuantity: line.requestedQuantity,
      dispatchedQuantity: line.dispatchedQuantity ?? null,
      receivedQuantity: line.receivedQuantity ?? null,
      discrepancyQuantity: line.discrepancyQuantity ?? null,
    })),
  };
}

async function loadScopedTransfer(id, user, session) {
  let query = StockTransfer.findOne({ _id: id, ...locationFilter(user) });
  if (session) query = query.session(session);
  const transfer = await query;
  if (!transfer) throw statusError('Stock transfer not found', 404);
  return transfer;
}

async function createTransfer(req, res, next) {
  let session;
  try {
    const { fromWarehouseId, toWarehouseId } = req.body;
    if (!canManageSource(req.user, fromWarehouseId)) {
      throw statusError('You can only create transfers from your assigned warehouse', 403);
    }
    if (fromWarehouseId === toWarehouseId) throw statusError('Transfer locations must be different', 400);

    const [from, to] = await Promise.all([
      Location.findById(fromWarehouseId).lean(),
      Location.findById(toWarehouseId).lean(),
    ]);
    if (!from || from.type !== 'CENTRAL' || !to || to.type !== 'OUTLET') {
      throw statusError('Transfers must move stock from a central warehouse to an outlet', 400);
    }

    const lines = normalizeRequestedLines(req.body.lines);
    const products = await Product.find({ _id: { $in: lines.map(({ productId }) => productId) } })
      .select('_id').lean();
    if (products.length !== lines.length) throw statusError('One or more products were not found', 400);

    session = await mongoose.startSession();
    let output;
    await session.withTransaction(async () => {
      const [transfer] = await StockTransfer.create([{
        fromWarehouseId,
        toWarehouseId,
        lines,
        createdBy: req.user._id,
      }], { session });
      await AuditLog.create([{
        actorId: req.user._id,
        action: 'CREATE',
        entity: 'StockTransfer',
        entityId: transfer._id,
        after: transfer.toObject(),
        ipAddress: req.ip,
      }], { session });
      output = transferOutput(transfer);
    });
    return res.status(201).json({ success: true, stockTransfer: output });
  } catch (error) {
    return next(error);
  } finally {
    if (session) await session.endSession();
  }
}

async function listTransfers(req, res, next) {
  try {
    const filter = locationFilter(req.user);
    if (req.query.status) filter.status = req.query.status;
    const transfers = await StockTransfer.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, stockTransfers: transfers.map(transferOutput) });
  } catch (error) {
    return next(error);
  }
}

async function getTransfer(req, res, next) {
  try {
    const transfer = await loadScopedTransfer(req.params.id, req.user);
    return res.json({ success: true, stockTransfer: transferOutput(transfer) });
  } catch (error) {
    return next(error);
  }
}

async function dispatchTransfer(req, res, next) {
  let session;
  try {
    session = await mongoose.startSession();
    let output;
    await session.withTransaction(async () => {
      const transfer = await loadScopedTransfer(req.params.id, req.user, session);
      if (!canManageSource(req.user, transfer.fromWarehouseId)) {
        throw statusError('Only the source warehouse can dispatch this transfer', 403);
      }
      if (transfer.status !== 'Requested') throw statusError('Only requested transfers can be dispatched', 409);
      const quantities = new Map(req.body.lines.map((line) => [
        line.productId.toString(), Number(line.dispatchedQuantity),
      ]));
      const productIds = transfer.lines.map((line) => line.productId.toString());
      if (quantities.size !== productIds.length || productIds.some((id) => !quantities.has(id))) {
        throw statusError('Dispatch quantities must include every transfer product exactly once', 400);
      }
      const available = await StockMovement.aggregate([
        { $match: { warehouseId: transfer.fromWarehouseId, productId: { $in: transfer.lines.map((line) => line.productId) } } },
        { $group: { _id: '$productId', quantity: { $sum: '$quantity' } } },
      ]).session(session);
      const stockByProduct = new Map(available.map(({ _id, quantity }) => [_id.toString(), quantity]));
      for (const line of transfer.lines) {
        const quantity = quantities.get(line.productId.toString());
        if (quantity > (stockByProduct.get(line.productId.toString()) || 0)) {
          throw statusError('Insufficient stock to dispatch this transfer', 409);
        }
        line.dispatchedQuantity = quantity;
      }
      if (![...quantities.values()].some((quantity) => quantity > 0)) {
        throw statusError('At least one product must be dispatched', 400);
      }

      const before = transfer.toObject();
      transfer.status = 'Dispatched';
      transfer.dispatchedBy = req.user._id;
      transfer.dispatchedAt = new Date();
      await transfer.save({ session });
      const movements = transfer.lines
        .filter((line) => line.dispatchedQuantity > 0)
        .map((line) => ({
          productId: line.productId,
          warehouseId: transfer.fromWarehouseId,
          quantity: -line.dispatchedQuantity,
          type: 'TRANSFER_OUT',
          userId: req.user._id,
          reason: `Stock transfer ${transfer._id}`,
          referenceId: transfer._id,
          referenceType: 'StockTransfer',
        }));
      await StockMovement.create(movements, { session });
      await AuditLog.create([{
        actorId: req.user._id,
        action: 'DISPATCH',
        entity: 'StockTransfer',
        entityId: transfer._id,
        before,
        after: transfer.toObject(),
        ipAddress: req.ip,
      }], { session });
      output = transferOutput(transfer);
    });
    return res.json({ success: true, stockTransfer: output });
  } catch (error) {
    return next(error);
  } finally {
    if (session) await session.endSession();
  }
}

async function receiveTransfer(req, res, next) {
  let session;
  try {
    session = await mongoose.startSession();
    let output;
    await session.withTransaction(async () => {
      const transfer = await loadScopedTransfer(req.params.id, req.user, session);
      if (!canReceive(req.user, transfer.toWarehouseId)) {
        throw statusError('Only the receiving outlet can confirm this transfer', 403);
      }
      if (transfer.status !== 'Dispatched') throw statusError('Only dispatched transfers can be received', 409);
      const quantities = new Map(req.body.lines.map((line) => [
        line.productId.toString(), Number(line.receivedQuantity),
      ]));
      const productIds = transfer.lines.map((line) => line.productId.toString());
      if (quantities.size !== productIds.length || productIds.some((id) => !quantities.has(id))) {
        throw statusError('Received quantities must include every transfer product exactly once', 400);
      }

      const before = transfer.toObject();
      let discrepancy = false;
      for (const line of transfer.lines) {
        line.receivedQuantity = quantities.get(line.productId.toString());
        line.discrepancyQuantity = Math.abs(line.dispatchedQuantity - line.receivedQuantity);
        if (line.discrepancyQuantity > 0.000000001) discrepancy = true;
      }
      transfer.status = discrepancy ? 'Discrepancy' : 'Received';
      transfer.receivedBy = req.user._id;
      transfer.receivedAt = new Date();
      await transfer.save({ session });
      const movements = transfer.lines
        .filter((line) => line.receivedQuantity > 0)
        .map((line) => ({
          productId: line.productId,
          warehouseId: transfer.toWarehouseId,
          quantity: line.receivedQuantity,
          type: 'TRANSFER_IN',
          userId: req.user._id,
          reason: `Stock transfer ${transfer._id}`,
          referenceId: transfer._id,
          referenceType: 'StockTransfer',
        }));
      if (movements.length) await StockMovement.create(movements, { session });
      await AuditLog.create([{
        actorId: req.user._id,
        action: 'RECEIVE',
        entity: 'StockTransfer',
        entityId: transfer._id,
        before,
        after: transfer.toObject(),
        ipAddress: req.ip,
      }], { session });
      output = transferOutput(transfer);
    });
    return res.json({ success: true, stockTransfer: output });
  } catch (error) {
    return next(error);
  } finally {
    if (session) await session.endSession();
  }
}

module.exports = {
  createTransfer, listTransfers, getTransfer, dispatchTransfer, receiveTransfer,
};
