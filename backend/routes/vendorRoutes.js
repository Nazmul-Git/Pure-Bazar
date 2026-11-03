const express = require('express');
const { body, param, query } = require('express-validator');
const vendorsController = require('../controllers/vendorsController');
const vendorSettlementController = require('../controllers/vendorSettlementController');
const vendorOverviewController = require('../controllers/vendorOverviewController');
const vendorRegistrationController = require('../controllers/vendorRegistrationController');
const { vendorKybUpload } = require('../middlewares/vendorKybUpload');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeMiddleware = require('../middlewares/authorizeMiddleware');
const validateRequest = require('../middlewares/validateRequest');

const router = express.Router();
const read = [authMiddleware, authorizeMiddleware({ permissions: ['vendors:read'] })];
const write = [authMiddleware, authorizeMiddleware({ permissions: ['vendors:write'] })];
const payoutRead = [authMiddleware, authorizeMiddleware({ permissions: ['vendor-payouts:read'] })];
const payoutWrite = [authMiddleware, authorizeMiddleware({ permissions: ['vendor-payouts:write'] })];
const isDateOnly = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const periodDate = (name) => body(name).isISO8601({ strict: true, strictSeparator: true })
  .custom(isDateOnly).withMessage(`${name} must be a valid YYYY-MM-DD date`);
const mobile = body('mobile').custom((value) => /^\+?[0-9]{7,20}$/.test(value))
  .withMessage('Mobile must contain 7 to 20 digits');
const field = (name, label, max) => body(name).isString().trim().isLength({ min: 1, max })
  .withMessage(`${label} must be 1 to ${max} characters`);

router.post('/registrations', write, vendorKybUpload, vendorRegistrationController.register);
router.get('/registrations', read, [
  query('status').optional().isIn(['PENDING', 'APPROVED', 'REJECTED'])
    .withMessage('Status must be PENDING, APPROVED, or REJECTED'),
], validateRequest, vendorRegistrationController.list);
router.get('/terms', write, vendorsController.getTerms);
router.get('/', read, [
  query('q').optional().isString().trim().isLength({ max: 100 })
    .withMessage('Search must be at most 100 characters'),
  query('status').optional().isIn(['Active', 'Suspended', 'Closed'])
    .withMessage('Status must be Active, Suspended, or Closed'),
], validateRequest, vendorsController.list);

router.get('/:vendorId/ledger', read, [
  param('vendorId').isMongoId().withMessage('A valid vendor ID is required'),
  query('startDate').isISO8601({ strict: true, strictSeparator: true })
    .custom(isDateOnly)
    .withMessage('startDate must be a valid YYYY-MM-DD date'),
  query('endDate').isISO8601({ strict: true, strictSeparator: true })
    .custom(isDateOnly)
    .withMessage('endDate must be a valid YYYY-MM-DD date'),
], validateRequest, vendorSettlementController.listLedger);

router.get('/:vendorId/overview', read, [
  param('vendorId').isMongoId().withMessage('A valid vendor ID is required'),
  query('startDate').optional().isISO8601({ strict: true, strictSeparator: true })
    .custom(isDateOnly).withMessage('startDate must be a valid YYYY-MM-DD date'),
  query('endDate').optional().isISO8601({ strict: true, strictSeparator: true })
    .custom(isDateOnly).withMessage('endDate must be a valid YYYY-MM-DD date'),
], validateRequest, vendorOverviewController.overview);

router.get('/:vendorId/statements', read, [
  param('vendorId').isMongoId().withMessage('A valid vendor ID is required'),
], validateRequest, vendorSettlementController.listStatements);

router.post('/:vendorId/statements', write, [
  param('vendorId').isMongoId().withMessage('A valid vendor ID is required'),
  periodDate('startDate'),
  periodDate('endDate'),
], validateRequest, vendorSettlementController.createStatement);

router.get('/payouts', payoutRead, [
  query('vendorId').optional().isMongoId().withMessage('A valid vendor ID is required'),
], validateRequest, vendorSettlementController.listPayouts);

router.patch('/statements/:statementId/status', payoutWrite, [
  param('statementId').isMongoId().withMessage('A valid statement ID is required'),
  body('status').isIn(['Approved', 'Paid']).withMessage('Status must be Approved or Paid'),
  body('paymentMethod').optional().isIn(['Cash', 'Bank', 'bKash', 'Nagad', 'Wallet'])
    .withMessage('Payment method must be Cash, Bank, bKash, Nagad, or Wallet'),
  body('paymentReference').optional().isString().trim().isLength({ min: 1, max: 150 })
    .withMessage('Payment reference must be 1 to 150 characters'),
  body('paidAt').optional().isISO8601({ strict: true })
    .withMessage('A valid payment date is required'),
  body('receiverName').optional().isString().trim().isLength({ min: 1, max: 150 })
    .withMessage('Receiver must be 1 to 150 characters'),
], validateRequest, vendorSettlementController.updateStatementStatus);

router.post('/', write, [
  field('memberId', 'Probashi Member ID', 100),
  field('name', 'Name', 150),
  body('applicantNameBn').optional({ checkFalsy: true }).isString().trim().isLength({ max: 150 })
    .withMessage('Bengali applicant name must be at most 150 characters'),
  body('fatherName').optional({ checkFalsy: true }).isString().trim().isLength({ max: 150 })
    .withMessage("Father's name must be at most 150 characters"),
  body('motherName').optional({ checkFalsy: true }).isString().trim().isLength({ max: 150 })
    .withMessage("Mother's name must be at most 150 characters"),
  body('dateOfBirth').optional({ checkFalsy: true }).isISO8601({ strict: true, strictSeparator: true })
    .custom((value) => new Date(value).getTime() <= Date.now())
    .withMessage('Date of birth must be a valid date in the past'),
  body('nationality').optional().isString().trim().isLength({ min: 1, max: 100 })
    .withMessage('Nationality must be 1 to 100 characters'),
  field('nidOrPassportNumber', 'NID or Passport number', 50),
  field('presentAddress', 'Present address', 500),
  field('permanentAddress', 'Permanent address', 500),
  mobile,
  body('emergencyContact').optional({ checkFalsy: true })
    .custom((value) => /^\+?[0-9]{7,20}$/.test(value))
    .withMessage('Emergency contact must contain 7 to 20 digits'),
  body('email').optional({ checkFalsy: true }).isEmail().isLength({ max: 254 })
    .withMessage('A valid email of at most 254 characters is required'),
  field('shopName', 'Shop name', 150),
  field('tradeLicenseNumber', 'Trade License Number', 100),
  field('address', 'Address', 500),
  field('productCategory', 'Product category', 100),
  body('payoutMethod').optional().isIn(['Cash', 'Bank', 'bKash', 'Nagad'])
    .withMessage('Payout method must be Cash, Bank, bKash, or Nagad'),
  body('accountDetails').optional({ checkFalsy: true }).isString().trim().isLength({ max: 250 })
    .withMessage('Account details must be at most 250 characters'),
  body('termsAccepted').isBoolean().toBoolean().custom((value) => value === true)
    .withMessage('Vendor terms must be accepted'),
  field('termsVersion', 'Terms version', 50),
], validateRequest, vendorsController.create);

router.patch('/:id/status', write, [
  param('id').isMongoId().withMessage('A valid vendor ID is required'),
  body('status').isIn(['Active', 'Suspended', 'Closed'])
    .withMessage('Status must be Active, Suspended, or Closed'),
], validateRequest, vendorsController.updateStatus);

module.exports = router;
