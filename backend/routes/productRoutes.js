const express = require('express');
const { body, param } = require('express-validator');
const productsController = require('../controllers/productsController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeMiddleware = require('../middlewares/authorizeMiddleware');
const validateRequest = require('../middlewares/validateRequest');

const router = express.Router();
const read = [authMiddleware, authorizeMiddleware({ permissions: ['products:read'] })];
const write = [authMiddleware, authorizeMiddleware({ permissions: ['products:write'] })];
const id = param('id').isMongoId().withMessage('A valid product ID is required');
const name = body('name').isString().trim().isLength({ min: 1, max: 150 })
  .withMessage('Name must be 1 to 150 characters');
const categoryId = body('categoryId').isMongoId().withMessage('A valid category ID is required');
const unitId = body('unitId').isMongoId().withMessage('A valid unit ID is required');
const ownerType = body('ownerType').isIn(['COMPANY', 'VENDOR']).withMessage('Owner type must be COMPANY or VENDOR');
const vendorPrice = body('vendorPrice').isFloat({ min: 0 }).toFloat()
  .withMessage('Vendor price must be zero or greater');
const mrp = body('mrp').isFloat({ min: 0 }).toFloat()
  .withMessage('MRP must be zero or greater')
  .custom((value, { req }) => (
    req.body.vendorPrice === undefined || value >= Number(req.body.vendorPrice)
  )).withMessage('MRP must be greater than or equal to vendor price');
const optionalId = (field) => body(field).optional({ nullable: true }).isMongoId()
  .withMessage(`${field} must be a valid ID`);
const optionalPrice = (field) => body(field).optional().isFloat({ min: 0 }).toFloat()
  .withMessage(`${field} must be zero or greater`);

router.get('/', read, productsController.listProducts);
router.post('/', write, [
  name, categoryId, unitId, ownerType, vendorPrice, mrp,
  optionalId('brandId'), optionalId('vendorId'),
  body('vatApplicable').optional().isBoolean().toBoolean()
    .withMessage('vatApplicable must be a boolean'),
  optionalPrice('vatRate').custom((value) => value === undefined || value <= 100)
    .withMessage('vatRate must be between 0 and 100'),
], validateRequest, productsController.createProduct);
router.get('/:id', read, [id], validateRequest, productsController.getProduct);
router.put('/:id', write, [
  id,
  body('name').optional().isString().trim().isLength({ min: 1, max: 150 })
    .withMessage('Name must be 1 to 150 characters'),
  body('categoryId').optional().isMongoId().withMessage('A valid category ID is required'),
  body('unitId').optional().isMongoId().withMessage('A valid unit ID is required'),
  body('ownerType').optional().isIn(['COMPANY', 'VENDOR'])
    .withMessage('Owner type must be COMPANY or VENDOR'),
  optionalPrice('vendorPrice'),
  optionalPrice('mrp').custom((value, { req }) => (
    value === undefined || req.body.vendorPrice === undefined || value >= Number(req.body.vendorPrice)
  )).withMessage('MRP must be greater than or equal to vendor price'),
  optionalId('brandId'), optionalId('vendorId'),
  body('vatApplicable').optional().isBoolean().toBoolean()
    .withMessage('vatApplicable must be a boolean'),
  optionalPrice('vatRate').custom((value) => value === undefined || value <= 100)
    .withMessage('vatRate must be between 0 and 100'),
  body('reason').optional().isString().trim().isLength({ min: 1, max: 500 })
    .withMessage('Reason must be 1 to 500 characters'),
], validateRequest, productsController.updateProduct);

module.exports = router;
