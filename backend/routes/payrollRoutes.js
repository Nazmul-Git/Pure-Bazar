const express = require('express');
const { body, param, query } = require('express-validator');
const payrollController = require('../controllers/payrollController');
const salarySheetController = require('../controllers/salarySheetController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeMiddleware = require('../middlewares/authorizeMiddleware');
const validateRequest = require('../middlewares/validateRequest');

const router = express.Router();
const can = (permission) => [authMiddleware, authorizeMiddleware({ permissions: [permission] })];
const methods = ['Cash', 'Bank', 'bKash', 'Nagad', 'Card'];
const mongoId = (name) => param(name).isMongoId().withMessage(`A valid ${name} is required`);
const money = (chain) => chain.isFloat({ min: 0 }).withMessage('Must be 0 or more').toFloat();

const employeeFields = (optional) => {
  const wrap = (chain) => (optional ? chain.optional() : chain);
  return [
    wrap(body('employeeCode')).isString().trim().isLength({ min: 1, max: 50 }),
    wrap(body('name')).isString().trim().isLength({ min: 1, max: 150 }),
    wrap(money(body('baseSalary'))),
    body('phone').optional().isString().trim().isLength({ max: 30 }),
    body('email').optional().isEmail(),
    body('designation').optional().isString().trim().isLength({ max: 100 }),
    body('department').optional().isString().trim().isLength({ max: 100 }),
    body('hireDate').optional().isISO8601({ strict: true }),
    body('status').optional().isIn(['ACTIVE', 'INACTIVE']),
  ];
};

router.get('/employees', can('employees:read'), [
  query('status').optional().isIn(['ACTIVE', 'INACTIVE']),
], validateRequest, payrollController.listEmployees);
router.post('/employees', can('employees:write'), employeeFields(false),
  validateRequest, payrollController.createEmployee);
router.patch('/employees/:id', can('employees:write'), [mongoId('id'), ...employeeFields(true)],
  validateRequest, payrollController.updateEmployee);

router.get('/advances', can('payroll:read'), [
  query('employeeId').optional().isMongoId(),
  query('status').optional().isIn(['Draft', 'Approved', 'Paid', 'Rejected']),
], validateRequest, payrollController.listAdvances);
router.post('/advances', can('payroll:write'), [
  body('employeeId').isMongoId().withMessage('A valid employee is required'),
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0').toFloat(),
  body('reason').isString().trim().isLength({ min: 1, max: 500 }),
  body('requestedAt').optional().isISO8601({ strict: true }),
], validateRequest, payrollController.createAdvance);
router.post('/advances/:id/approve', can('payroll:write'), [mongoId('id')], validateRequest, payrollController.approveAdvance);
router.post('/advances/:id/reject', can('payroll:write'), [mongoId('id')], validateRequest, payrollController.rejectAdvance);
router.post('/advances/:id/pay', can('payroll:write'), [mongoId('id')], validateRequest, payrollController.payAdvance);

router.get('/sheets', can('payroll:read'), [
  query('status').optional().isIn(['Draft', 'Approved', 'Paid']),
], validateRequest, salarySheetController.listSheets);
router.post('/sheets', can('payroll:write'), [
  body('month').matches(/^\d{4}-(0[1-9]|1[0-2])$/).withMessage('Month must be YYYY-MM'),
], validateRequest, salarySheetController.createSheet);
router.get('/sheets/:id', can('payroll:read'), [mongoId('id')], validateRequest, salarySheetController.getSheet);
router.patch('/sheets/:id/lines/:employeeId', can('payroll:write'), [
  mongoId('id'), mongoId('employeeId'),
  money(body('allowances').optional()),
  money(body('otherDeductions').optional()),
], validateRequest, salarySheetController.updateLine);
router.post('/sheets/:id/approve', can('payroll:write'), [mongoId('id')], validateRequest, salarySheetController.approveSheet);
router.post('/sheets/:id/pay', can('payroll:write'), [
  mongoId('id'),
  body('paymentMethod').isIn(methods).withMessage('Invalid payment method'),
  body('locationId').optional().isMongoId(),
], validateRequest, salarySheetController.paySheet);
router.get('/sheets/:id/payslips/:employeeId', can('payroll:read'), [
  mongoId('id'), mongoId('employeeId'),
], validateRequest, salarySheetController.payslip);

module.exports = router;
