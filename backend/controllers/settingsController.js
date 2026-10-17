const Joi = require('joi');
const { AuditLog, Settings } = require('../models');

const paymentMethods = ['Cash', 'Bank', 'bKash', 'Nagad', 'Card', 'Wallet'];
const vendorPayoutMethods = ['Cash', 'Bank', 'bKash', 'Nagad'];
const settingsInputSchema = Joi.object({
  shareholderDiscountPercent: Joi.number().min(0).max(100),
  vatEnabled: Joi.boolean(),
  defaultVatRate: Joi.number().min(0).max(100),
  vatPriceMode: Joi.string().valid('INCLUDED', 'EXCLUDED'),
  vatCalculationOrder: Joi.string().valid('DISCOUNT_THEN_VAT', 'VAT_THEN_DISCOUNT'),
  discountLimitByRole: Joi.object().pattern(
    Joi.string().pattern(/^(?!\$)(?!.*\.).+$/),
    Joi.number().min(0).max(100),
  ),
  enabledPaymentMethods: Joi.array().items(Joi.string().valid(...paymentMethods)).unique(),
  receiptLayout: Joi.object().unknown(true),
  vendorTerms: Joi.array().items(Joi.object({
    version: Joi.string().trim().min(1).required(),
    terms: Joi.string().trim().min(1).required(),
    effectiveFrom: Joi.date().iso().required(),
  }).unknown(false)).unique('version'),
  probashiStatus: Joi.string().valid('NotConfigured', 'Active', 'Inactive'),
  vendorSettlementCyclePerMonth: Joi.number().integer().valid(1, 2),
  vendorPayoutCutoffDates: Joi.array().items(Joi.number().integer().min(1).max(31)).unique(),
  enabledVendorPayoutMethods: Joi.array().items(Joi.string().valid(...vendorPayoutMethods)).unique(),
  commissionEnabled: Joi.boolean(),
  vendorWalletPayoutEnabled: Joi.boolean(),
  outlets: Joi.array().items(Joi.object().unknown(true)),
}).min(1).unknown(false);

function statusError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function settingsResponse(settings) {
  const result = settings.toObject
    ? settings.toObject({ flattenMaps: true })
    : {
      ...settings,
      discountLimitByRole: settings.discountLimitByRole instanceof Map
        ? Object.fromEntries(settings.discountLimitByRole)
        : settings.discountLimitByRole || {},
    };
  delete result.singleton;
  return result;
}

function termsMatch(existing, incoming) {
  return existing.version === incoming.version
    && existing.terms === incoming.terms
    && new Date(existing.effectiveFrom).getTime() === new Date(incoming.effectiveFrom).getTime();
}

async function getSettings(req, res, next) {
  try {
    const settings = await Settings.findOne({ singleton: 'global' }).lean();
    return res.json({ success: true, settings: settingsResponse(settings || new Settings()) });
  } catch (error) {
    return next(error);
  }
}

async function updateSettings(req, res, next) {
  try {
    const { error, value } = settingsInputSchema.validate(req.body, {
      abortEarly: false,
      convert: true,
    });
    if (error) {
      const validationError = statusError('Request validation failed', 400);
      validationError.errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));
      throw validationError;
    }

    const current = await Settings.findOne({ singleton: 'global' });
    const existingTerms = current?.vendorTerms || [];
    if (value.vendorTerms) {
      if (value.vendorTerms.length < existingTerms.length
        || existingTerms.some((term, index) => !termsMatch(term, value.vendorTerms[index]))) {
        throw statusError('Vendor terms versions cannot be removed or changed', 400);
      }
      const knownVersions = new Set(existingTerms.map((term) => term.version));
      const newTerms = value.vendorTerms.slice(existingTerms.length);
      if (newTerms.some((term) => knownVersions.has(term.version))) {
        throw statusError('Vendor terms versions must be unique', 400);
      }
    }

    const cycle = value.vendorSettlementCyclePerMonth ?? current?.vendorSettlementCyclePerMonth ?? 1;
    const cutoffDates = value.vendorPayoutCutoffDates ?? current?.vendorPayoutCutoffDates ?? [];
    if (cutoffDates.length && cutoffDates.length !== cycle) {
      throw statusError('The number of cut-off dates must match the settlement cycle', 400);
    }

    const before = current ? settingsResponse(current) : null;
    const settings = await Settings.findOneAndUpdate(
      { singleton: 'global' },
      { $set: value },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
    const after = settingsResponse(settings);
    await AuditLog.create({
      actorId: req.user._id,
      action: 'UPDATE',
      entity: 'Settings',
      entityId: settings._id,
      before,
      after,
      metadata: { changedFields: Object.keys(value) },
      ipAddress: req.ip,
    });
    return res.json({ success: true, settings: after });
  } catch (error) {
    return next(error);
  }
}

async function listAuditLogs(req, res, next) {
  try {
    const filter = {};
    if (req.query.who) filter.actorId = req.query.who;
    if (req.query.what) {
      filter.$or = [{ action: req.query.what }, { entity: req.query.what }];
    }
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) {
        const endDate = /^\d{4}-\d{2}-\d{2}$/.test(req.query.to)
          ? `${req.query.to}T23:59:59.999Z`
          : req.query.to;
        filter.createdAt.$lte = new Date(endDate);
      }
    }

    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('actorId', 'name email')
      .lean();
    return res.json({ success: true, auditLogs: logs });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getSettings, listAuditLogs, updateSettings };
