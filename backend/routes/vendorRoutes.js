const express = require('express');
const { body, param, query } = require('express-validator');
const vendorsController = require('../controllers/vendorsController');
const vendorSettlementController = require('../controllers/vendorSettlementController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeMiddleware = require('../middlewares/authorizeMiddleware');
const validateRequest = require('../middlewares/validateRequest');

const router = express.Router();
const read = [authMiddleware, authorizeMiddleware({ permissions: ['vendors:read'] })];
const write = [authMiddleware, authorizeMiddleware({ permissions: ['vendors:write'] })];
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

router.get('/:vendorId/statements', read, [
  param('vendorId').isMongoId().withMessage('A valid vendor ID is required'),
], validateRequest, vendorSettlementController.listStatements);

router.post('/:vendorId/statements', write, [
  param('vendorId').isMongoId().withMessage('A valid vendor ID is required'),
  periodDate('startDate'),
  periodDate('endDate'),
], validateRequest, vendorSettlementController.createStatement);

router.patch('/statements/:statementId/status', write, [
  param('statementId').isMongoId().withMessage('A valid statement ID is required'),
  body('status').isIn(['Approved', 'Paid']).withMessage('Status must be Approved or Paid'),
  body('paymentMethod').optional().isIn(['Cash', 'Bank', 'bKash', 'Nagad'])
    .withMessage('Payment method must be Cash, Bank, bKash, or Nagad'),
  body('paymentReference').optional().isString().trim().isLength({ min: 1, max: 150 })
    .withMessage('Payment reference must be 1 to 150 characters'),
  body('paidAt').optional().isISO8601({ strict: true })
    .withMessage('A valid payment date is required'),
  body('settlementRef').optional().isString().trim().isLength({ max: 150 })
    .withMessage('Settlement reference must be at most 150 characters'),
], validateRequest, vendorSettlementController.updateStatementStatus);

router.post('/', write, [
  field('memberId', 'Shareholder ID', 100),
  field('name', 'Name', 150),
  mobile,
  field('shopName', 'Shop name', 150),
  field('address', 'Address', 500),
  field('productCategory', 'Product category', 100),
  body('payoutMethod').isIn(['Cash', 'Bank', 'bKash', 'Nagad'])
    .withMessage('Payout method must be Cash, Bank, bKash, or Nagad'),
  field('accountDetails', 'Account details', 250),
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
