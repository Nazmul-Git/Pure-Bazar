const { AuditLog, VendorRegistration } = require('../models');
const { validateVendorKyb, normalizeVendorKyb } = require('../utils/vendorKybValidation');
const { saveKybFiles } = require('../middlewares/vendorKybUpload');

function parsePayload(raw) {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    return null;
  }
}

function failValidation(message, errors) {
  const error = new Error(message);
  error.status = 400;
  error.errors = errors;
  return error;
}

async function register(req, res, next) {
  try {
    const payload = parsePayload(req.body?.data);
    if (!payload) throw failValidation('Request validation failed', [{ field: 'data', message: 'Registration data must be valid JSON' }]);
    const errors = validateVendorKyb(payload, req.kybFiles || {});
    if (errors.length) throw failValidation('Request validation failed', errors);

    const documents = await saveKybFiles(req.kybFiles);
    const registration = await VendorRegistration.create({
      ...normalizeVendorKyb(payload),
      documents,
      createdBy: req.user._id,
    });
    await AuditLog.create({
      actorId: req.user._id,
      action: 'VENDOR_KYB_SUBMITTED',
      entity: 'VendorRegistration',
      entityId: registration._id,
      after: { companyName: registration.businessLegalIdentity.companyName, verificationStatus: 'PENDING' },
      ipAddress: req.ip,
    });
    return res.status(201).json({ success: true, registration });
  } catch (error) {
    return next(error);
  }
}

async function list(req, res, next) {
  try {
    const filter = req.query.status ? { verificationStatus: req.query.status } : {};
    const registrations = await VendorRegistration.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    return res.json({ success: true, registrations });
  } catch (error) {
    return next(error);
  }
}

module.exports = { register, list };
