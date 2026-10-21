const express = require('express');
const { body, param, query } = require('express-validator');
const shareholderController = require('../controllers/shareholderController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeMiddleware = require('../middlewares/authorizeMiddleware');
const validateRequest = require('../middlewares/validateRequest');

const router = express.Router();
const read = [authMiddleware, authorizeMiddleware({ permissions: ['shareholders:read'] })];
const posWrite = [authMiddleware, authorizeMiddleware({ permissions: ['pos:write'] })];
const walletRead = [authMiddleware, authorizeMiddleware({ permissions: ['wallet-logs:read'] })];
const walletWrite = [authMiddleware, authorizeMiddleware({ permissions: ['wallet-logs:write'] })];
const memberId = body('memberId').optional().isString().trim().isLength({ min: 1, max: 100 });
const amount = body('amount').isFloat().toFloat().custom((value) => value > 0)
  .withMessage('Amount must be greater than zero');
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;

router.get('/', read, [
  query('memberId').optional().isString().trim().isLength({ min: 1, max: 100 }),
  query('mobile').optional().custom((value) => /^\+?[0-9]{7,20}$/.test(value))
    .withMessage('Mobile must contain 7 to 20 digits'),
], validateRequest, shareholderController.searchShareholders);
router.get('/wallet-logs', walletRead, [
  query('date').optional().custom(validDate).withMessage('Date must be a valid YYYY-MM-DD date'),
  query('memberId').optional().isString().trim().isLength({ min: 1, max: 100 }),
], validateRequest, shareholderController.listWalletLogs);
router.post('/verify', posWrite, [
  memberId,
  body('mobile').optional().custom((value) => /^\+?[0-9]{7,20}$/.test(value))
    .withMessage('Mobile must contain 7 to 20 digits'),
  body().custom((value) => Boolean(value.memberId || value.mobile))
    .withMessage('A member ID or mobile is required'),
], validateRequest, shareholderController.verifyMember);
router.post('/balance-check', posWrite, [
  body('memberId').isString().trim().isLength({ min: 1, max: 100 }),
  amount,
], validateRequest, shareholderController.checkWalletBalance);
router.get('/:memberId/transactions', walletRead, [
  param('memberId').isString().trim().isLength({ min: 1, max: 100 }),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
], validateRequest, shareholderController.listTransactions);
router.post('/refund', walletWrite, [
  body('memberId').isString().trim().isLength({ min: 1, max: 100 }),
  body('transactionId').isString().trim().isLength({ min: 1, max: 100 }),
  amount,
], validateRequest, shareholderController.refund);
router.get('/:id/purchases', read, [
  param('id').isMongoId().withMessage('A valid shareholder ID is required'),
], validateRequest, shareholderController.purchaseHistory);

module.exports = router;
