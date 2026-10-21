const express = require('express');
const { query } = require('express-validator');
const { getDashboard } = require('../services/dashboardService');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeMiddleware = require('../middlewares/authorizeMiddleware');
const validateRequest = require('../middlewares/validateRequest');

const router = express.Router();

router.get('/', authMiddleware, authorizeMiddleware({ permissions: ['dashboard:read'] }), [
  query('lowStockThreshold').optional().isFloat({ min: 0 }).withMessage('Threshold must be 0 or more').toFloat(),
], validateRequest, async (req, res, next) => {
  try {
    const dashboard = await getDashboard({ lowStockThreshold: req.query.lowStockThreshold });
    return res.json({ success: true, dashboard });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
