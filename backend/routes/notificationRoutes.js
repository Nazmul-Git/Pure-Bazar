const express = require('express');
const { query } = require('express-validator');
const { getNotifications } = require('../services/notificationService');
const authMiddleware = require('../middlewares/authMiddleware');
const validateRequest = require('../middlewares/validateRequest');

const router = express.Router();

router.get('/', authMiddleware, [
  query('lowStockThreshold').optional().isFloat({ min: 0 }).withMessage('Threshold must be 0 or more').toFloat(),
], validateRequest, async (req, res, next) => {
  try {
    const notifications = await getNotifications(req.user, { lowStockThreshold: req.query.lowStockThreshold });
    return res.json({ success: true, notifications });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
