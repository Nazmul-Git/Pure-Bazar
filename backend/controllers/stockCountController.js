const mongoose = require('mongoose');
const {
  AuditLog, Location, Settings, StockAdjustment, StockCount,
} = require('../models');
const {
  statusError, canManageLocation, adjustmentValue, loadProducts, currentStock, postMovements, objectOf,
} = require('../utils/stockAdjustments');

async function listCounts(req, res, next) {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (['Super Admin', 'Inventory Manager'].includes(req.user.role) && req.query.warehouseId) {
      filter.warehouseId = req.query.warehouseId;
    } else if (req.user.role === 'Warehouse Staff' && req.user.locationId) {
      filter.warehouseId = req.user.locationId;
    } else if (!['Super Admin', 'Inventory Manager'].includes(req.user.role)) {
      throw statusError('Insufficient role permissions', 403);
    }
    const counts = await StockCount.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, stockCounts: counts });
  } catch (error) {
    return next(error);
  }
}

async function createCount(req, res, next) {
  let session;
  try {
    const { warehouseId } = req.body;
    if (!canManageLocation(req.user, warehouseId)) {
      throw statusError('You can only count stock at your assigned warehouse', 403);
    }
    const productIds = req.body.lines.map((line) => line.productId);
    if (new Set(productIds).size !== productIds.length) {
      throw statusError('A product can only appear once on a stock count', 400);
    }
    session = await mongoose.startSession();
    let output;
    await session.withTransaction(async () => {
      const location = await Location.findById(warehouseId).session(session).lean();
      if (!location) throw statusError('Warehouse or outlet not found', 404);
      await loadProducts(productIds, session);
      const balances = await currentStock(
        warehouseId,
        productIds.map((id) => new mongoose.Types.ObjectId(id)),
        session,
      );
      const lines = req.body.lines.map((line) => ({
        productId: line.productId,
        expectedQuantity: balances.get(line.productId.toString()) || 0,
        countedQuantity: Number(line.countedQuantity),
        difference: Number(line.countedQuantity) - (balances.get(line.productId.toString()) || 0),
      }));
      const [count] = await StockCount.create([{
        warehouseId,
        reason: req.body.reason,
        status: 'Counting',
        lines,
        createdBy: req.user._id,
      }], { session });
      await AuditLog.create([{
        actorId: req.user._id, action: 'CREATE', entity: 'StockCount', entityId: count._id,
        after: objectOf(count), ipAddress: req.ip,
      }], { session });
      output = objectOf(count);
    });
    return res.status(201).json({ success: true, stockCount: output });
  } catch (error) {
    return next(error);
  } finally {
    if (session) await session.endSession();
  }
}

async function postCount(req, res, next) {
  let session;
  try {
    session = await mongoose.startSession();
    let output;
    await session.withTransaction(async () => {
      const count = await StockCount.findById(req.params.id).session(session);
      if (!count) throw statusError('Stock count not found', 404);
      if (!canManageLocation(req.user, count.warehouseId)) {
        throw statusError('You can only post counts at your assigned warehouse', 403);
      }
      if (count.status !== 'Counting' || count.stockAdjustmentId) {
        throw statusError('Only unposted counts can be posted', 409);
      }
      const before = objectOf(count);
      const lines = count.lines
        .map((line) => ({
          productId: line.productId,
          quantity: Math.round((line.countedQuantity - line.expectedQuantity + Number.EPSILON) * 1000000) / 1000000,
        }))
        .filter((line) => line.quantity !== 0);
      if (!lines.length) {
        count.status = 'Posted';
        count.postedBy = req.user._id;
        await count.save({ session });
      } else {
        const products = await loadProducts(lines.map((line) => line.productId.toString()), session);
        const settings = await Settings.findOne({ singleton: 'global' }).session(session).lean();
        const approvalLimit = settings?.stockAdjustmentApprovalLimit || 0;
        const value = adjustmentValue(lines, products);
        const [adjustment] = await StockAdjustment.create([{
          warehouseId: count.warehouseId,
          reason: count.reason,
          status: value <= approvalLimit ? 'Approved' : 'Pending',
          lines,
          value,
          approvalLimit,
          stockCountId: count._id,
          createdBy: req.user._id,
          approvedBy: value <= approvalLimit ? req.user._id : undefined,
        }], { session });
        count.stockAdjustmentId = adjustment._id;
        if (adjustment.status === 'Approved') {
          await postMovements(adjustment, req.user._id, session);
          count.status = 'Posted';
          count.postedBy = req.user._id;
        } else {
          count.status = 'PendingApproval';
        }
        await count.save({ session });
        await AuditLog.create([{
          actorId: req.user._id, action: 'CREATE', entity: 'StockAdjustment', entityId: adjustment._id,
          after: objectOf(adjustment), ipAddress: req.ip,
        }], { session });
      }
      await AuditLog.create([{
        actorId: req.user._id, action: count.status === 'PendingApproval' ? 'SUBMIT' : 'POST',
        entity: 'StockCount', entityId: count._id, before, after: objectOf(count), ipAddress: req.ip,
      }], { session });
      output = objectOf(count);
    });
    return res.json({ success: true, stockCount: output });
  } catch (error) {
    return next(error);
  } finally {
    if (session) await session.endSession();
  }
}

module.exports = { listCounts, createCount, postCount };
