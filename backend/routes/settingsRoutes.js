const express = require('express');
const { query } = require('express-validator');
const settingsController = require('../controllers/settingsController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeMiddleware = require('../middlewares/authorizeMiddleware');
const validateRequest = require('../middlewares/validateRequest');

const router = express.Router();
const adminOnly = [authMiddleware, authorizeMiddleware({ roles: ['Super Admin'] })];
const auditFilters = [
  query('who').optional().isMongoId().withMessage('Who must be a valid user ID'),
  query('what').optional().isString().trim().isLength({ min: 1, max: 80 }).withMessage('What must be 1 to 80 characters'),
  query('from').optional().isISO8601().withMessage('From must be a valid date'),
  query('to').optional().isISO8601().withMessage('To must be a valid date'),
  query('from').custom((value, { req }) => {
    if (value && req.query.to && new Date(value) > new Date(req.query.to)) {
      throw new Error('From must be before or equal to to');
    }
    return true;
  }),
];

router.get('/settings', adminOnly, settingsController.getSettings);
router.put('/settings', adminOnly, settingsController.updateSettings);
router.get('/audit-logs', adminOnly, auditFilters, validateRequest, settingsController.listAuditLogs);

module.exports = router;
