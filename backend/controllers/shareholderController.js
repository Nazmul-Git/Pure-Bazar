const { Order, Shareholder, WalletAuditLog } = require('../models');
const probashiWalletService = require('../services/probashiWalletService');

function statusError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function auditedRequest(req, action, memberId, work) {
  let succeeded = false;
  try {
    const result = await work();
    succeeded = true;
    return result;
  } finally {
    await WalletAuditLog.create({
      memberId,
      action,
      succeeded,
      createdBy: req.user._id,
    });
  }
}

async function searchShareholders(req, res, next) {
  try {
    const { memberId, mobile } = req.query;
    if (Boolean(memberId) === Boolean(mobile)) {
      throw statusError('Supply exactly one of memberId or mobile', 400);
    }
    const identifier = String(memberId || mobile).trim();
    const shareholders = await auditedRequest(req, 'MEMBER_VERIFY', identifier, async () => {
      const member = await probashiWalletService.verifyMember({
        ...(memberId ? { memberId } : { mobile }),
      });
      const mirroredMemberId = member.memberId || memberId || `MOBILE-${mobile}`;
      const shareholder = await Shareholder.findOneAndUpdate(
        { memberId: mirroredMemberId },
        {
          $set: {
            memberId: mirroredMemberId,
            name: member.name || mirroredMemberId,
            mobile: member.mobile || undefined,
            verified: member.valid,
            active: member.active,
            walletEnabled: member.walletEnabled,
          },
        },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
      );
      if (!shareholder) throw statusError('Unable to mirror the verified shareholder', 500);
      const purchases = await Order.find({ memberId: shareholder._id })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
      const status = !member.valid
        ? 'invalid'
        : !member.active
          ? 'inactive'
          : !member.walletEnabled
            ? 'wallet disabled'
            : 'valid';
      const record = typeof shareholder.toObject === 'function'
        ? shareholder.toObject()
        : shareholder;
      return [{ ...record, status, purchases }];
    });
    return res.json({ success: true, shareholders });
  } catch (error) {
    return next(error);
  }
}

async function verifyMember(req, res, next) {
  const memberId = String(req.body.memberId || req.body.mobile || '').trim();
  try {
    const member = await auditedRequest(req, 'MEMBER_VERIFY', memberId, () => (
      probashiWalletService.verifyMember({
        ...(req.body.memberId ? { memberId: req.body.memberId } : {}),
        ...(req.body.mobile ? { mobile: req.body.mobile } : {}),
      })
    ));
    if (member.valid && member.memberId) {
      if (!member.mobile) throw statusError('Probashi did not return a member mobile number', 502);
      await Shareholder.findOneAndUpdate(
        { memberId: member.memberId },
        { $set: member },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
      );
    }
    return res.json({ success: true, member });
  } catch (error) {
    return next(error);
  }
}

async function checkWalletBalance(req, res, next) {
  try {
    const result = await auditedRequest(req, 'WALLET_BALANCE_CHECK', req.body.memberId, () => (
      probashiWalletService.checkWalletBalance(req.body)
    ));
    return res.json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
}

async function listTransactions(req, res, next) {
  const memberId = req.params.memberId;
  try {
    const result = await auditedRequest(req, 'TRANSACTION_REPORT', memberId, () => (
      probashiWalletService.getTransactionReport({
        memberId,
        from: req.query.from,
        to: req.query.to,
      })
    ));
    return res.json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
}

async function refund(req, res, next) {
  const { memberId, transactionId, amount } = req.body;
  try {
    const result = await auditedRequest(req, 'REFUND', memberId, () => (
      probashiWalletService.refund({ memberId, transactionId, amount })
    ));
    return res.json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
}

async function purchaseHistory(req, res, next) {
  try {
    const shareholder = await Shareholder.findById(req.params.id).select('_id').lean();
    if (!shareholder) throw statusError('Shareholder not found', 404);
    const orders = await Order.find({ memberId: shareholder._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return res.json({ success: true, purchases: orders });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  checkWalletBalance,
  listTransactions,
  purchaseHistory,
  refund,
  searchShareholders,
  verifyMember,
};
