const mongoose = require('mongoose');
const {
  AuditLog, Location, Settings, StockAdjustment, StockCount,
} = require('../models');
const {
  statusError, canManageLocation, adjustmentValue, loadProducts, postMovements, objectOf,
} = require('../utils/stockAdjustments');

function normalizeLines(lines) {
  const quantities = new Map();
  for (const line of lines) {
    const id = line.productId.toString();
    quantities.set(id, (quantities.get(id) || 0) + Number(line.quantity));
  }
  return [...quantities]
    .filter(([, quantity]) => quantity !== 0)
    .map(([productId, quantity]) => ({ productId, quantity }));
}

async function listAdjustments(req, res, next) {
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
    const adjustments = await StockAdjustment.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, stockAdjustments: adjustments });
  } catch (error) {
    return next(error);
  }

}

async function createAdjustment(req, res, next) {
  let session;
  try {
    const { warehouseId } = req.body;
    if (!canManageLocation(req.user, warehouseId)) {
      throw statusError('You can only adjust stock at your assigned warehouse', 403);
    }
    const lines = normalizeLines(req.body.lines);
    if (!lines.length) throw statusError('At least one non-zero adjustment line is required', 400);

    session = await mongoose.startSession();
    let output;
    await session.withTransaction(async () => {
      const location = await Location.findById(warehouseId).session(session).lean();
      if (!location) throw statusError('Warehouse or outlet not found', 404);
      const productIds = lines.map((line) => line.productId);
      const products = await loadProducts(productIds, session);
      const [settings, adjustment] = await Promise.all([
        Settings.findOne({ singleton: 'global' }).session(session).lean(),
        StockAdjustment.create([{
          warehouseId,
          reason: req.body.reason,
          lines,
          createdBy: req.user._id,
          value: adjustmentValue(lines, products),
          approvalLimit: 0,
        }], { session }),
      ]);
      const document = adjustment[0];
      document.approvalLimit = settings?.stockAdjustmentApprovalLimit || 0;
      if (document.value <= document.approvalLimit) {
        await postMovements(document, req.user._id, session);
        document.status = 'Approved';
        document.approvedBy = req.user._id;
      }
      await document.save({ session });
      await AuditLog.create([{
        actorId: req.user._id,
        action: 'CREATE',
        entity: 'StockAdjustment',
        entityId: document._id,
        after: objectOf(document),
        ipAddress: req.ip,
      }], { session });
      output = objectOf(document);
    });
    return res.status(201).json({ success: true, stockAdjustment: output });
  } catch (error) {
    return next(error);
  } finally {
    if (session) await session.endSession();
  }
}

async function approveAdjustment(req, res, next) {
  let session;
  try {
    session = await mongoose.startSession();
    let output;
    await session.withTransaction(async () => {
      const adjustment = await StockAdjustment.findById(req.params.id).session(session);
      if (!adjustment) throw statusError('Stock adjustment not found', 404);
      if (adjustment.status !== 'Pending') throw statusError('Only pending adjustments can be approved', 409);
      const before = objectOf(adjustment);
      await postMovements(adjustment, req.user._id, session);
      adjustment.status = 'Approved';
      adjustment.approvedBy = req.user._id;
      await adjustment.save({ session });
      if (adjustment.stockCountId) {
        const count = await StockCount.findById(adjustment.stockCountId).session(session);
        if (count) {
          const countBefore = objectOf(count);
          count.status = 'Posted';
          count.postedBy = req.user._id;
          await count.save({ session });
          await AuditLog.create([{
            actorId: req.user._id, action: 'POST', entity: 'StockCount', entityId: count._id,
            before: countBefore, after: objectOf(count), ipAddress: req.ip,
          }], { session });
        }
      }
      await AuditLog.create([{
        actorId: req.user._id, action: 'APPROVE', entity: 'StockAdjustment', entityId: adjustment._id,
        before, after: objectOf(adjustment), ipAddress: req.ip,
      }], { session });
      output = objectOf(adjustment);
    });
    return res.json({ success: true, stockAdjustment: output });
  } catch (error) {
    return next(error);
  } finally {
    if (session) await session.endSession();
  }
}

async function rejectAdjustment(req, res, next) {
  let session;
  try {
    session = await mongoose.startSession();
    let output;
    await session.withTransaction(async () => {
      const adjustment = await StockAdjustment.findById(req.params.id).session(session);
      if (!adjustment) throw statusError('Stock adjustment not found', 404);
      if (adjustment.status !== 'Pending') throw statusError('Only pending adjustments can be rejected', 409);
      const before = objectOf(adjustment);
      adjustment.status = 'Rejected';
      await adjustment.save({ session });
      if (adjustment.stockCountId) {
        const count = await StockCount.findById(adjustment.stockCountId).session(session);
        if (count) {
          const countBefore = objectOf(count);
          count.status = 'Rejected';
          await count.save({ session });
          await AuditLog.create([{
            actorId: req.user._id, action: 'REJECT', entity: 'StockCount', entityId: count._id,
            before: countBefore, after: objectOf(count), ipAddress: req.ip,
          }], { session });
        }
      }
      await AuditLog.create([{
        actorId: req.user._id, action: 'REJECT', entity: 'StockAdjustment', entityId: adjustment._id,
        before, after: objectOf(adjustment), ipAddress: req.ip,
      }], { session });
      output = objectOf(adjustment);
    });
    return res.json({ success: true, stockAdjustment: output });
  } catch (error) {
    return next(error);
  } finally {
    if (session) await session.endSession();
  }
}

module.exports = {
  listAdjustments, createAdjustment, approveAdjustment, rejectAdjustment,
};
