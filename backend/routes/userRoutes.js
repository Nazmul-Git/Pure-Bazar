const express = require('express');
const { body, param } = require('express-validator');
const usersController = require('../controllers/usersController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeMiddleware = require('../middlewares/authorizeMiddleware');
const validateRequest = require('../middlewares/validateRequest');

const router = express.Router();
const adminOnly = [authMiddleware, authorizeMiddleware({ roles: ['Super Admin'] })];
const userFields = [
  body('name').isString().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2 to 100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('A valid email is required'),
  body('roleId').isMongoId().withMessage('A valid role is required'),
  body('isActive').optional().isBoolean().toBoolean(),
];

router.get('/', adminOnly, usersController.list);
router.post('/', adminOnly, [
  ...userFields,
  body('password').isString().isLength({ min: 8, max: 128 }).withMessage('Password must be at least 8 characters'),
], validateRequest, usersController.create);
router.put('/:id', adminOnly, [
  param('id').isMongoId().withMessage('A valid user ID is required'),
  ...userFields,
  body('password').optional({ values: 'falsy' }).isString().isLength({ min: 8, max: 128 }).withMessage('Password must be at least 8 characters'),
], validateRequest, usersController.update);
router.delete('/:id', adminOnly, [
  param('id').isMongoId().withMessage('A valid user ID is required'),
], validateRequest, usersController.remove);

module.exports = router;