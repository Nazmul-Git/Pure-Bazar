const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');
const validateRequest = require('../middlewares/validateRequest');

const { createLoginLimiter } = require('../config/security');

const router = express.Router();
const loginLimiter = process.env.NODE_ENV === 'test'
  ? (req, res, next) => next()
  : createLoginLimiter();

router.post('/login', loginLimiter, [
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('password').isString().isLength({ min: 1, max: 200 }).withMessage('Password is required'),
], validateRequest, authController.login);
router.get('/me', authMiddleware, authController.me);
router.post('/logout', authMiddleware, authController.logout);

module.exports = router;