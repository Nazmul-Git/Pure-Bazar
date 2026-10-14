const express = require('express');
const { body, param } = require('express-validator');
const rolesController = require('../controllers/rolesController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeMiddleware = require('../middlewares/authorizeMiddleware');
const validateRequest = require('../middlewares/validateRequest');

const router = express.Router();
const adminOnly = [authMiddleware, authorizeMiddleware({ roles: ['Super Admin'] })];
const roleFields = [
  body('name').isString().trim().isLength({ min: 2, max: 80 }).withMessage('Role name must be 2 to 80 characters'),
  body('permissions').optional().isArray().withMessage('Permissions must be a list'),
  body('permissions.*').optional().isString().trim().notEmpty().withMessage('Permissions must be non-empty strings'),
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