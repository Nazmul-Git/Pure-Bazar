const express = require('express');
const { body, param } = require('express-validator');
const inventoryController = require('../controllers/inventoryController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeMiddleware = require('../middlewares/authorizeMiddleware');
const brandLogoUpload = require('../middlewares/brandLogoUpload');
const validateRequest = require('../middlewares/validateRequest');

const router = express.Router();
const read = (permission) => [authMiddleware, authorizeMiddleware({ permissions: [`${permission}:read`] })];
const write = (permission) => [authMiddleware, authorizeMiddleware({ permissions: [`${permission}:write`] })];
const id = param('id').isMongoId().withMessage('A valid ID is required');
const name = body('name').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Name must be 1 to 100 characters');
const rate = (field) => body(field).optional({ nullable: true }).isFloat({ min: 0, max: 100 }).toFloat()
  .withMessage(`${field} must be between 0 and 100`);

router.get('/categories', read('categories'), inventoryController.listCategories);
router.post('/categories', write('categories'), [
  name,
  rate('vatRate'),
  rate('commissionPercent'),
  body('commissionEnabled').optional().custom((value) => value === false)
    .withMessage('Category commission is disabled'),
], validateRequest, inventoryController.createCategory);
router.put('/categories/:id', write('categories'), [
  id, name, rate('vatRate'), rate('commissionPercent'),
  body('commissionEnabled').optional().custom((value) => value === false)
    .withMessage('Category commission is disabled'),
], validateRequest, inventoryController.updateCategory);
router.delete('/categories/:id', write('categories'), [id], validateRequest, inventoryController.removeCategory);

router.get('/brands', read('brands'), inventoryController.listBrands);
router.post('/brands', write('brands'), brandLogoUpload, [name], validateRequest, inventoryController.createBrand);
router.put('/brands/:id', write('brands'), [id], brandLogoUpload, [name], validateRequest, inventoryController.updateBrand);
router.delete('/brands/:id', write('brands'), [id], validateRequest, inventoryController.removeBrand);
router.get('/brands/:id/logo', read('brands'), [id], validateRequest, inventoryController.getBrandLogo);

router.get('/units', read('units'), inventoryController.listUnits);
router.post('/units', write('units'), [
  name,
  body('abbreviation').isString().trim().isLength({ min: 1, max: 20 })
    .withMessage('Abbreviation must be 1 to 20 characters'),
], validateRequest, inventoryController.createUnit);
router.put('/units/:id', write('units'), [
  id, name,
  body('abbreviation').isString().trim().isLength({ min: 1, max: 20 })
    .withMessage('Abbreviation must be 1 to 20 characters'),
], validateRequest, inventoryController.updateUnit);
router.delete('/units/:id', write('units'), [id], validateRequest, inventoryController.removeUnit);

module.exports = router;
