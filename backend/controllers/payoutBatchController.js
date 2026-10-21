const mongoose = require('mongoose');
const { AuditLog, VendorStatement } = require('../models');

function statusError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// Approves several Draft vendor statements in one request. Nothing is
// approved unless every statement in the batch is an existing Draft.
async function approveBatch(req, res, next) {
  try {
    const ids = [...new Set(req.body.statementIds.map(String))];
    const statements = await VendorStatement.find({ _id: { $in: ids } });
    if (statements.length !== ids.length) throw statusError('One or more statements were not found', 404);
    const notDraft = statements.filter((statement) => statement.status !== 'Draft');
    if (notDraft.length) {
      throw statusError(`Only draft statements can be approved: ${notDraft.map((s) => s.statementNumber).join(', ')}`, 409);
    }

    const batchId = new mongoose.Types.ObjectId().toString();
    const approvedAt = new Date();
    for (const statement of statements) {
      const before = statement.toObject();
      statement.status = 'Approved';
      statement.approvedBy = req.user._id;
      statement.approvedAt = approvedAt;
      await statement.save();
      await AuditLog.create({
        actorId: req.user._id,
        action: 'UPDATE',
        entity: 'VendorStatement',
        entityId: statement._id,
        before,
        after: statement.toObject(),
        ipAddress: req.ip,
        metadata: { changedFields: ['status', 'approvedBy', 'approvedAt'], payoutBatchId: batchId },
      });
    }
    await AuditLog.create({
      actorId: req.user._id,
      action: 'APPROVE',
      entity: 'PayoutBatch',
      entityId: new mongoose.Types.ObjectId(batchId),
      after: { statementIds: ids, count: ids.length },
      ipAddress: req.ip,
    });
    return res.json({ success: true, batchId, approved: statements.length, statements });
  } catch (error) {
    return next(error);
  }
}

module.exports = { approveBatch };
