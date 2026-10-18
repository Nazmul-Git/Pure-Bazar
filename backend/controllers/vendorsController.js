const {
  AuditLog, Settings, Vendor, WalletAuditLog,
} = require('../models');
const probashiWalletService = require('../services/probashiWalletService');

function statusError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function getTerms(req, res, next) {
  try {
    const settings = await Settings.findOne({ singleton: 'global' }).lean();
    const now = Date.now();
    const currentTerms = (settings?.vendorTerms || [])
      .filter((term) => new Date(term.effectiveFrom).getTime() <= now)
      .sort((left, right) => new Date(right.effectiveFrom) - new Date(left.effectiveFrom))[0] || null;
    return res.json({
      success: true,
      terms: currentTerms && {
        version: currentTerms.version,
        terms: currentTerms.terms,
        effectiveFrom: currentTerms.effectiveFrom,
      },
    });
  } catch (error) {
    return next(error);
  }
}

function vendorOutput(vendor) {
  const data = vendor.toObject ? vendor.toObject() : vendor;
  return {
    id: data._id.toString(),
    memberId: data.memberId,
    name: data.name,
    mobile: data.mobile,
    shopName: data.shopName,
    address: data.address,
    productCategory: data.productCategory,
    payoutMethod: data.payoutMethod,
    accountDetails: data.accountDetails,
    termsAccepted: data.termsAccepted,
    termsVersion: data.termsVersion,
    status: data.status,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

async function list(req, res, next) {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.q) {
      const escaped = req.query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = ['memberId', 'name', 'mobile', 'shopName', 'productCategory']
        .map((field) => ({ [field]: new RegExp(escaped, 'i') }));
    }
    const vendors = await Vendor.find(filter).sort({ name: 1 }).lean();
    return res.json({ success: true, vendors: vendors.map(vendorOutput) });
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  const memberId = req.body.memberId.trim();
  let verified = false;
  let member;
  try {
    try {
      member = await probashiWalletService.verifyMember({ memberId });
      verified = true;
    } finally {
      await WalletAuditLog.create({
        memberId,
        action: 'MEMBER_VERIFY',
        succeeded: verified,
        createdBy: req.user._id,
      });
    }
    if (!member.valid || !member.active || !member.walletEnabled) {
      throw statusError('Member must be valid, active, and wallet-enabled', 403);
    }

    let vendor;
    try {
      [vendor] = await Vendor.create([{
        memberId: member.memberId,
        name: req.body.name,
        mobile: req.body.mobile,
        shopName: req.body.shopName,
        address: req.body.address,
        productCategory: req.body.productCategory,
        payoutMethod: req.body.payoutMethod,
        accountDetails: req.body.accountDetails,
        termsAccepted: req.body.termsAccepted,
        termsVersion: req.body.termsVersion,
        status: 'Active',
      }]);
    } catch (error) {
      if (error.code === 11000) throw statusError('A vendor is already registered for this member', 409);
      throw error;
    }
    await AuditLog.create({
      actorId: req.user._id,
      action: 'CREATE',
      entity: 'Vendor',
      entityId: vendor._id,
      after: vendor.toObject(),
      ipAddress: req.ip,
    });
    return res.status(201).json({ success: true, vendor: vendorOutput(vendor) });
  } catch (error) {
    return next(error);
  }
}

async function updateStatus(req, res, next) {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) throw statusError('Vendor not found', 404);
    const before = vendor.toObject();
    vendor.status = req.body.status;
    await vendor.save();
    await AuditLog.create({
      actorId: req.user._id,
      action: 'UPDATE',
      entity: 'Vendor',
      entityId: vendor._id,
      before,
      after: vendor.toObject(),
      ipAddress: req.ip,
      metadata: { changedFields: ['status'] },
    });
    return res.json({ success: true, vendor: vendorOutput(vendor) });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  create,
  getTerms,
  list,
  updateStatus,
};
