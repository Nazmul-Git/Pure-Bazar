const express = require('express');
const { body, param } = require('express-validator');
const rolesController = require('../controllers/rolesController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeMiddleware = require('../middlewares/authorizeMiddleware');
const validateRequest = require('../middlewares/validateRequest');

const router = express.Router();
const adminOnly = [authMiddleware, authorizeMiddleware({ roles: ['Super Admin'] })];
const allowedPermissions = [
  'dashboard:read',
  'pos:read', 'pos:write', 'orders:read', 'orders:write', 'returns:read', 'returns:write', 'shifts:read', 'shifts:write',
  'products:read', 'products:write', 'categories:read', 'categories:write', 'brands:read', 'brands:write',
  'units:read', 'units:write', 'stock:read', 'stock:write', 'warehouse:read', 'warehouse:write',
  'stock:transfer:read', 'stock:transfer:write', 'stock:transfer:receive',
  'vendors:read', 'vendors:write',
  'finance:read', 'finance:write', 'expenses:read', 'expenses:write', 'vendor-payouts:read', 'vendor-payouts:write',
  'shareholders:read', 'wallet-logs:read', 'wallet-logs:write', 'reports:read', 'reports:sales-stock:read',
  'employees:read', 'employees:write', 'payroll:read', 'payroll:write',
  'salary-advances:read', 'salary-advances:write', 'expense-categories:read', 'expense-categories:write',
  'settings:read', 'settings:write', 'roles:read', 'roles:write', 'auditlogs:read', 'auditlogs:write',
];
const roleFields = [
  body('name').isString().trim().isLength({ min: 2, max: 80 }).withMessage('Role name must be 2 to 80 characters'),
  body('permissions').optional().isArray({ max: 100 }).withMessage('Permissions must be a list of at most 100 entries')
    .bail().custom((permissions) => new Set(permissions).size === permissions.length)
    .withMessage('Permissions must not contain duplicates'),
  body('permissions.*').optional().isString().trim().isIn(allowedPermissions)
    .withMessage('Permission is not supported'),
];

router.get('/', adminOnly, rolesController.list);
router.post('/', adminOnly, roleFields, validateRequest, rolesController.create);
router.put('/:id', adminOnly, [
  param('id').isMongoId().withMessage('A valid role ID is required'),
  ...roleFields,
], validateRequest, rolesController.update);
router.delete('/:id', adminOnly, [
  param('id').isMongoId().withMessage('A valid role ID is required'),
], validateRequest, rolesController.remove);

module.exports = router;