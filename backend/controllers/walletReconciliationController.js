const { AuditLog, WalletReconciliation } = require('../models');
const service = require('../services/walletReconciliationService');

function statusError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

const today = () => service.dhakaDate(new Date());

async function list(req, res, next) {
  try {
    res.json(await service.summarize(req.query.date || today()));
  } catch (error) { next(error); }
}

async function run(req, res, next) {
  try {
    const date = req.body.date || today();
    if (date > today()) throw statusError('Cannot reconcile a future date', 400);
    const result = await service.reconcileDate(date);
    await AuditLog.create({
      actorId: req.user._id,
      action: 'CREATE',
      entity: 'WalletReconciliation',
      after: result.totals,
      ipAddress: req.ip,
      metadata: { date },
    });
    res.json(result);
  } catch (error) { next(error); }
}

async function resolve(req, res, next) {
  try {
    const record = await WalletReconciliation.findById(req.params.id);
    if (!record) throw statusError('Reconciliation record not found', 404);
    if (record.status !== 'Mismatch') throw statusError('Only mismatches can be resolved', 409);
    if (record.resolved) throw statusError('This mismatch is already resolved', 409);
    const before = record.toObject();
    record.resolved = true;
    record.resolutionReason = req.body.reason;
    record.resolvedBy = req.user._id;
    record.resolvedAt = new Date();
    await record.save();
    await AuditLog.create({
      actorId: req.user._id,
      action: 'UPDATE',
      entity: 'WalletReconciliation',
      entityId: record._id,
      before,
      after: record.toObject(),
      ipAddress: req.ip,
      metadata: { changedFields: ['resolved', 'resolutionReason', 'resolvedBy', 'resolvedAt'] },
    });
    res.json({ record });
  } catch (error) { next(error); }
}

module.exports = { list, run, resolve };
