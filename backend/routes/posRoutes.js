const express = require('express');
const { body, param } = require('express-validator');
const posController = require('../controllers/posController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeMiddleware = require('../middlewares/authorizeMiddleware');
const validateRequest = require('../middlewares/validateRequest');

const router = express.Router();
const read = [authMiddleware, authorizeMiddleware({ permissions: ['pos:read'] })];
const write = [authMiddleware, authorizeMiddleware({ permissions: ['pos:write'] })];

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
