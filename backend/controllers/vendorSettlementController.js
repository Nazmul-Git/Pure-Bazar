const {
  AuditLog, GoodsReceive, Settings, Vendor, VendorStatement,
} = require('../models');
const {
  generateStatement, getLedger, periodBounds,
} = require('../services/vendorSettlementService');

function statusError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function requireVendor(vendorId) {
  const vendor = await Vendor.findById(vendorId).lean();
  if (!vendor) throw statusError('Vendor not found', 404);
  return vendor;
}

async function assertWalletPayoutAllowed() {
  const settings = await Settings.findOne({ singleton: 'global' }).lean();
  if (!settings?.vendorWalletPayoutEnabled) {
    throw statusError('Vendor wallet payout is disabled', 403);
  }
  throw statusError('Vendor wallet payout is not available yet', 501);
}

async function assertMethodEnabled(method) {
  const settings = await Settings.findOne({ singleton: 'global' }).lean();
  const enabled = settings?.enabledVendorPayoutMethods;
  if (enabled && !enabled.includes(method)) {
    throw statusError(`Payout method ${method} is not enabled`, 400);
  }
}

function parsePeriod(req) {
  const { start, endExclusive } = periodBounds(req.query.startDate || req.body.startDate, req.query.endDate || req.body.endDate);
  if (endExclusive <= start) throw statusError('Period end must be on or after period start', 400);
  return { start, endExclusive };
}

function statementNumber(vendorId, periodStart, periodEnd) {
  const formatDate = (date) => date.toISOString().slice(0, 10).replace(/-/g, '');
  return `VST-${vendorId}-${formatDate(periodStart)}-${formatDate(periodEnd)}`;
}

async function listLedger(req, res, next) {
  try {
    await requireVendor(req.params.vendorId);
    const { start, endExclusive } = parsePeriod(req);
    const ledger = await getLedger(req.params.vendorId, start, endExclusive);
    return res.json({ success: true, ...ledger });
  } catch (error) {
    return next(error);
  }
}

async function listStatements(req, res, next) {
  try {
    await requireVendor(req.params.vendorId);
    const statements = await VendorStatement.find({ vendorId: req.params.vendorId })
      .sort({ periodStart: -1, createdAt: -1 })
      .lean();
    return res.json({ success: true, statements });
  } catch (error) {
    return next(error);
  }
}

async function createStatement(req, res, next) {
  try {
    const vendor = await requireVendor(req.params.vendorId);
    const { start, endExclusive } = parsePeriod(req);
    const periodEnd = new Date(endExclusive.getTime() - 1);
    const existing = await VendorStatement.findOne({
      vendorId: vendor._id,
      periodStart: start,
      periodEnd,
    }).lean();
    if (existing) throw statusError('A statement already exists for this vendor period', 409);

    const figures = await generateStatement(vendor._id, req.body.startDate, req.body.endDate);
    const statement = (await VendorStatement.create([{
      vendorId: vendor._id,
      statementNumber: statementNumber(vendor._id, figures.periodStart, figures.periodEnd),
      ...figures,
      status: 'Draft',
    }]))[0];
    await AuditLog.create({
      actorId: req.user._id,
      action: 'CREATE',
      entity: 'VendorStatement',
      entityId: statement._id,
      after: statement.toObject(),
      ipAddress: req.ip,
    });
    return res.status(201).json({ success: true, statement });
  } catch (error) {
    if (error.code === 11000) return next(statusError('A statement already exists for this vendor period', 409));
    return next(error);
  }
}

async function updateStatementStatus(req, res, next) {
  try {
    const statement = await VendorStatement.findById(req.params.statementId);
    if (!statement) throw statusError('Vendor statement not found', 404);
    if (statement.status === 'Paid') throw statusError('Paid statements are locked', 409);
    const before = statement.toObject();
    const changedFields = ['status'];

    if (req.body.status === 'Approved') {
      if (statement.status !== 'Draft') throw statusError('Only draft statements can be approved', 409);
      statement.approvedBy = req.user._id;
      statement.approvedAt = new Date();
      changedFields.push('approvedBy', 'approvedAt');
    }
    if (req.body.status === 'Paid') {
      if (statement.status !== 'Approved') {
        throw statusError('Only approved statements can be paid', 409);
      }
      if (req.body.paymentMethod === 'Wallet') await assertWalletPayoutAllowed();
      const missing = !req.body.paymentMethod || !req.body.paymentReference
        || !req.body.paidAt || !req.body.receiverName;
      if (missing) {
        throw statusError('Payment method, reference, date, and receiver are required', 400);
      }
      await assertMethodEnabled(req.body.paymentMethod);
      statement.paymentMethod = req.body.paymentMethod;
      statement.paymentReference = req.body.paymentReference;
      statement.paidAt = new Date(req.body.paidAt);
      statement.receiverName = req.body.receiverName;
      statement.receivedBy = req.user._id;
      statement.settlementRef = statement.statementNumber;
      changedFields.push('paymentMethod', 'paymentReference', 'paidAt', 'receiverName', 'receivedBy', 'settlementRef');
    }

    statement.status = req.body.status;
    await statement.save();
    if (req.body.status === 'Paid') {
      await GoodsReceive.updateMany({
        vendorId: statement.vendorId,
        ownerType: 'VENDOR',
        status: 'Approved',
        settlementRef: { $exists: false },
        createdAt: { $gte: statement.periodStart, $lte: statement.periodEnd },
      }, { $set: { settlementRef: statement.settlementRef } });
    }
    await AuditLog.create({
      actorId: req.user._id,
      action: 'UPDATE',
      entity: 'VendorStatement',
      entityId: statement._id,
      before,
      after: statement.toObject(),
      ipAddress: req.ip,
      metadata: { changedFields },
    });
    return res.json({ success: true, statement });
  } catch (error) {
    return next(error);
  }
}

async function listPayouts(req, res, next) {
  try {
    const filter = { status: 'Paid' };
    if (req.query.vendorId) filter.vendorId = req.query.vendorId;
    const payouts = await VendorStatement.find(filter)
      .sort({ paidAt: -1, createdAt: -1 })
      .lean();
    return res.json({ success: true, payouts });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listPayouts,
  createStatement,
  listLedger,
  listStatements,
  updateStatementStatus,
};
