const express = require('express');
const { body, param, query } = require('express-validator');
const posController = require('../controllers/posController');
const posHistoryController = require('../controllers/posHistoryController');
const posShiftController = require('../controllers/posShiftController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeMiddleware = require('../middlewares/authorizeMiddleware');
const validateRequest = require('../middlewares/validateRequest');

const router = express.Router();
const read = [authMiddleware, authorizeMiddleware({ permissions: ['pos:read'] })];
const write = [authMiddleware, authorizeMiddleware({ permissions: ['pos:write'] })];
const paymentMethods = ['CASH', 'BKASH', 'NAGAD', 'CARD', 'WALLET'];
const validDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

router.get('/history', read, [
  query('outlet').optional().isMongoId(),
  query('cashier').optional().isMongoId(),
  query('shareholderId').optional().isMongoId(),
  query('vendor').optional().isMongoId(),
  query('paymentMethod').optional().isIn(paymentMethods),
  query('date').optional().custom(validDate).withMessage('Date must be a valid YYYY-MM-DD date'),
  query('from').optional().isISO8601({ strict: true, strictSeparator: true }),
  query('to').optional().isISO8601({ strict: true, strictSeparator: true }),
  query().custom((value) => !(value.date && (value.from || value.to)))
    .withMessage('Use date or from/to, not both'),
  query().custom((value) => (
    !value.from || !value.to || new Date(value.from) <= new Date(value.to)
  )).withMessage('from must be before or equal to to'),
], validateRequest, posHistoryController.listSalesHistory);
router.get('/shifts/current', read, posShiftController.getCurrentShift);
router.get('/shifts/:shiftId/report', read, [
  param('shiftId').isMongoId(),
], validateRequest, posShiftController.getShiftReport);
router.post('/shifts', write, [
  body('openingCash').isFloat({ min: 0 }).toFloat().custom((value) => (
    Math.abs(value * 100 - Math.round(value * 100)) < 1e-8
  )).withMessage('Opening cash must have at most two decimal places'),
  body('outletId').optional().isMongoId(),
], validateRequest, posShiftController.openShift);
router.post('/shifts/:shiftId/close', write, [
  param('shiftId').isMongoId(),
  body('actualCash').isFloat({ min: 0 }).toFloat().custom((value) => (
    Math.abs(value * 100 - Math.round(value * 100)) < 1e-8
  )).withMessage('Actual cash must have at most two decimal places'),
], validateRequest, posShiftController.closeShift);
router.post('/:orderId/return', write, [
  param('orderId').isMongoId(),
  body('walletRefunded').optional().isBoolean().toBoolean(),
  body('walletRefundMethod').optional().isIn(['MANUAL', 'API']),
  body().custom((value) => (
    value.walletRefunded !== true || Boolean(value.walletRefundMethod)
  )).withMessage('walletRefundMethod is required when walletRefunded is true'),
  body().custom((value) => (
    value.walletRefunded === true || !value.walletRefundMethod
  )).withMessage('walletRefundMethod requires walletRefunded to be true'),
], validateRequest, posHistoryController.returnBill);
router.get('/scan/:barcode', read, [
  param('barcode').isString().trim().isLength({ min: 1, max: 100 }),
], validateRequest, posController.scanItem);
router.post('/bill', read, posController.buildBill);
router.post('/verify-member', write, [
  body('memberId').optional().isString().trim().isLength({ min: 1, max: 100 }),
  body('mobile').optional().matches(/^\+?[0-9]{7,20}$/),
  body().custom((value) => Boolean(value.memberId || value.mobile))
    .withMessage('A member ID or mobile is required'),
], validateRequest, posController.verifyMember);
router.post('/checkout', write, posController.finalizeBill);
router.post('/offline-sync', write, posController.syncOfflineBill);

module.exports = router;
