const express = require('express');
const { body, param, query } = require('express-validator');
const goodsReceiveController = require('../controllers/goodsReceiveController');
const locationRoutes = require('./locationRoutes');
const stockController = require('../controllers/stockController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeMiddleware = require('../middlewares/authorizeMiddleware');
const validateRequest = require('../middlewares/validateRequest');

const router = express.Router();
router.use(locationRoutes);
const read = [authMiddleware, authorizeMiddleware({ permissions: ['stock:read'] })];
const write = [authMiddleware, authorizeMiddleware({ permissions: ['stock:write'] })];
const id = param('id').isMongoId().withMessage('A valid goods receive ID is required');
const lines = body('lines').isArray({ min: 1 }).withMessage('At least one product line is required');
const lineProduct = body('lines.*.productId').isMongoId().withMessage('A valid product ID is required');
const lineQuantity = (field, min) => body(`lines.*.${field}`).isFloat({ min }).toFloat()
  .withMessage(`${field} must be ${min === 0 ? 'zero or greater' : 'greater than zero'}`);
const lineQuantities = body('lines').custom((items) => (
  Array.isArray(items) && items.every((item) => (
    Number(item.acceptedQuantity) + Number(item.rejectedQuantity) <= Number(item.receivedQuantity)
  ))
)).withMessage('Accepted and rejected quantities cannot exceed received quantity');
const vendorId = body('vendorId').optional({ nullable: true }).isMongoId()
  .withMessage('A valid vendor ID is required');
const challan = body('vendorChallanNumber').optional({ nullable: true }).isString().trim().isLength({ max: 100 })
  .withMessage('Challan number must be at most 100 characters');

router.get('/stock', read, [
  query('warehouseId').isMongoId().withMessage('A valid warehouse ID is required'),
], validateRequest, stockController.getWarehouseStock);
router.get('/stock/products', read, [
  query('ownerType').isIn(['COMPANY', 'VENDOR']).withMessage('Owner type must be COMPANY or VENDOR'),
  query('vendorId').if(query('ownerType').equals('VENDOR')).isMongoId()
    .withMessage('Vendor purchases require a valid vendor ID'),
  query('q').optional().isString().trim().isLength({ max: 100 }).withMessage('Search must be at most 100 characters'),
], validateRequest, goodsReceiveController.searchProducts);
router.get('/stock/vendors', read, goodsReceiveController.listVendors);
router.get('/goods-receives', read, goodsReceiveController.listGoodsReceives);
router.post('/goods-receives', write, [
  body('ownerType').isIn(['COMPANY', 'VENDOR']).withMessage('Owner type must be COMPANY or VENDOR'),
  vendorId,
  body('warehouseId').isMongoId().withMessage('A valid warehouse ID is required'),
  challan,
  lines, lineProduct,
  lineQuantity('receivedQuantity', 0.000001),
  lineQuantity('acceptedQuantity', 0),
  lineQuantity('rejectedQuantity', 0),
  lineQuantities,
], validateRequest, goodsReceiveController.createGoodsReceive);
router.get('/goods-receives/:id', read, [id], validateRequest, goodsReceiveController.getGoodsReceive);
router.get('/goods-receives/:id/print', read, [id], validateRequest, goodsReceiveController.getGoodsReceive);
router.put('/goods-receives/:id', write, [
  id,
  body('ownerType').optional().isIn(['COMPANY', 'VENDOR']).withMessage('Owner type must be COMPANY or VENDOR'),
  vendorId,
  body('warehouseId').optional().isMongoId().withMessage('A valid warehouse ID is required'),
  challan,
  body('lines').optional().isArray({ min: 1 }).withMessage('At least one product line is required'),
  lineProduct.optional(),
  lineQuantity('receivedQuantity', 0.000001).optional(),
  lineQuantity('acceptedQuantity', 0).optional(),
  lineQuantity('rejectedQuantity', 0).optional(),
  body('lines').optional().custom((items) => items.every((item) => (
    Number(item.acceptedQuantity) + Number(item.rejectedQuantity) <= Number(item.receivedQuantity)
  ))).withMessage('Accepted and rejected quantities cannot exceed received quantity'),
], validateRequest, goodsReceiveController.updateGoodsReceive);
router.post('/goods-receives/:id/approve', write, [id], validateRequest, goodsReceiveController.approveGoodsReceive);
router.post('/goods-receives/:id/reject', write, [id], validateRequest, goodsReceiveController.rejectGoodsReceive);

module.exports = router;
