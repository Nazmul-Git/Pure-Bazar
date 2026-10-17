const express = require('express');
const { query } = require('express-validator');
const locationController = require('../controllers/locationController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeMiddleware = require('../middlewares/authorizeMiddleware');
const validateRequest = require('../middlewares/validateRequest');

const router = express.Router();

router.get('/locations', authMiddleware, authorizeMiddleware({ permissions: ['stock:read'] }), [
  query('type').optional().isIn(['CENTRAL', 'OUTLET']).withMessage('Location type must be CENTRAL or OUTLET'),
], validateRequest, locationController.listLocations);

module.exports = router;
