const { Shareholder, WalletAuditLog } = require('../models');
const { scanItem, searchItems } = require('../services/posCatalogService');
const probashiWalletService = require('../services/probashiWalletService');
const { loadBill, billOutput, statusError } = require('../services/posBillService');
const posCheckoutService = require('../services/posCheckoutService');

async function buildBill(req, res, next) {
  try {
    const result = await loadBill(req.body, req.user);
    return res.json({ success: true, bill: billOutput(result) });
  } catch (error) {
    return next(error);
  }
}

async function verifyMember(req, res, next) {
  const identifier = String(req.body.memberId || req.body.mobile || '').trim();
  let succeeded = false;
  let errorToPass;
  let shareholder;
  try {
    const member = await probashiWalletService.verifyMember(req.body);
    if (!member.valid || !member.active) {
      throw statusError('Shareholder must be valid and active', 403);
    }
    shareholder = await Shareholder.findOneAndUpdate(
      { memberId: member.memberId },
      { $set: { ...member, verified: member.valid === true } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
    if (!shareholder) throw statusError('Unable to attach the verified shareholder', 500);
    succeeded = true;
  } catch (error) {
    errorToPass = error;
  }
  try {
    await WalletAuditLog.create({
      memberId: identifier,
      action: 'MEMBER_VERIFY',
      succeeded,
      createdBy: req.user._id,
    });
  } catch (error) {
    return next(error);
  }
  if (errorToPass) return next(errorToPass);
  return res.json({ success: true, shareholder: shareholder.toObject ? shareholder.toObject() : shareholder });
}

module.exports = {
  buildBill,
  finalizeBill: posCheckoutService.finalizeBill,
  scanItem,
  searchItems,
  syncOfflineBill: posCheckoutService.syncOfflineBill,
  verifyMember,
};
