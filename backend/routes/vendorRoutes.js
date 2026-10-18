const express = require('express');
const { body, param, query } = require('express-validator');
const vendorsController = require('../controllers/vendorsController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeMiddleware = require('../middlewares/authorizeMiddleware');
const validateRequest = require('../middlewares/validateRequest');

const router = express.Router();
const read = [authMiddleware, authorizeMiddleware({ permissions: ['vendors:read'] })];
const write = [authMiddleware, authorizeMiddleware({ permissions: ['vendors:write'] })];
const mobile = body('mobile').custom((value) => /^\+?[0-9]{7,20}$/.test(value))
  .withMessage('Mobile must contain 7 to 20 digits');
const field = (name, label, max) => body(name).isString().trim().isLength({ min: 1, max })
  .withMessage(`${label} must be 1 to ${max} characters`);

router.get('/', read, [
  query('q').optional().isString().trim().isLength({ max: 100 })
    .withMessage('Search must be at most 100 characters'),
  query('status').optional().isIn(['Active', 'Suspended', 'Closed'])
    .withMessage('Status must be Active, Suspended, or Closed'),
], validateRequest, vendorsController.list);

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
