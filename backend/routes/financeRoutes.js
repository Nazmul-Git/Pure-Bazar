const express = require('express');
const { body, param, query } = require('express-validator');
const financeController = require('../controllers/financeController');
const payoutBatchController = require('../controllers/payoutBatchController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeMiddleware = require('../middlewares/authorizeMiddleware');
const expenseAttachmentUpload = require('../middlewares/expenseAttachmentUpload');
const validateRequest = require('../middlewares/validateRequest');

const router = express.Router();
const can = (permission) => [authMiddleware, authorizeMiddleware({ permissions: [permission] })];
const methods = ['Cash', 'Bank', 'bKash', 'Nagad', 'Card'];
const isDateOnly = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && new Date(value).toISOString().slice(0, 10) === value;
const dateQuery = (name, optional) => {
  const chain = query(name);
  return (optional ? chain.optional() : chain).custom(isDateOnly)
    .withMessage(`${name} must be a valid YYYY-MM-DD date`);
};
const expenseFields = (optional) => {
  const wrap = (chain) => (optional ? chain.optional() : chain);
  return [
    wrap(body('categoryId')).isMongoId().withMessage('A valid category is required'),
    wrap(body('amount')).isFloat({ gt: 0 }).withMessage('Amount must be greater than 0').toFloat(),
    wrap(body('description')).isString().trim().isLength({ min: 1, max: 500 })
      .withMessage('Description must be 1 to 500 characters'),
    wrap(body('paymentMethod')).isIn(methods).withMessage('Invalid payment method'),
    wrap(body('locationId')).isMongoId().withMessage('A valid location is required'),
    body('expenseDate').optional().isISO8601({ strict: true }).withMessage('A valid expense date is required'),
  ];
};

router.get('/revenue-ledger', can('finance:read'), [
  dateQuery('startDate'), dateQuery('endDate'),
], validateRequest, financeController.revenueLedger);

router.get('/expense-categories', can('expenses:read'), financeController.listExpenseCategories);
router.post('/expense-categories', can('expenses:write'), [
  body('name').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Name must be 1 to 100 characters'),
  body('description').optional().isString().trim().isLength({ max: 250 }),
], validateRequest, financeController.createExpenseCategory);

router.get('/expenses', can('expenses:read'), [
  dateQuery('startDate', true), dateQuery('endDate', true),
  query('categoryId').optional().isMongoId(),
  query('locationId').optional().isMongoId(),
  query('paymentMethod').optional().isIn(methods),
], validateRequest, financeController.listExpenses);
router.post('/expenses', ...can('expenses:write'), expenseAttachmentUpload,
  expenseFields(false), validateRequest, financeController.createExpense);
router.patch('/expenses/:id', ...can('expenses:write'), expenseAttachmentUpload, [
  param('id').isMongoId().withMessage('A valid expense ID is required'),
  ...expenseFields(true),
], validateRequest, financeController.updateExpense);

router.post('/payout-batches', can('vendor-payouts:write'), [
  body('statementIds').isArray({ min: 1, max: 100 }).withMessage('Select 1 to 100 statements'),
  body('statementIds.*').isMongoId().withMessage('Each statement ID must be valid'),
], validateRequest, payoutBatchController.approveBatch);

module.exports = router;
