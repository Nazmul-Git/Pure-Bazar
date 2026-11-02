const { AuditLog, Brand, Category, Product, Unit } = require('../models');

function statusError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function handleError(error, next) {
  if (error.code === 11000) error.status = 409;
  return next(error);
}

function snapshot(document) {
  return document && {
    id: document._id.toString(),
    name: document.name,
    ...(document.vatRate !== undefined ? { vatRate: document.vatRate } : {}),
    ...(document.commissionPercent !== undefined ? { commissionPercent: document.commissionPercent } : {}),
    ...(document.commissionEnabled !== undefined ? { commissionEnabled: false } : {}),
    ...(document.logo?.contentType ? { logoContentType: document.logo.contentType } : {}),
    ...(document.abbreviation !== undefined ? { abbreviation: document.abbreviation } : {}),
  };
}

function categorySnapshot(category) {
  return { ...snapshot(category), commissionEnabled: false };
}

function categoryOutput(category) {
  return categorySnapshot(category);
}

function brandOutput(brand) {
  return {
    id: brand._id.toString(),
    name: brand.name,
    logoUrl: brand.logo?.contentType ? `/api/brands/${brand._id}/logo` : null,
    createdAt: brand.createdAt,
    updatedAt: brand.updatedAt,
  };
}

function unitOutput(unit) {
  return {
    id: unit._id.toString(),
    name: unit.name,
    abbreviation: unit.abbreviation,
    createdAt: unit.createdAt,
    updatedAt: unit.updatedAt,
  };
}

async function listCategories(req, res, next) {
  try {
    const categories = await Category.find().sort({ name: 1 }).lean();
    return res.json({ success: true, categories: categories.map(categoryOutput) });
  } catch (error) {
    return next(error);
  }
}

async function createCategory(req, res, next) {
  try {
    const category = await Category.create({
      name: req.body.name,
      ...(req.body.vatRate !== undefined ? { vatRate: req.body.vatRate } : {}),
      ...(req.body.commissionPercent !== undefined ? { commissionPercent: req.body.commissionPercent } : {}),
      commissionEnabled: false,
    });
    await AuditLog.create({
      actorId: req.user._id, action: 'CREATE', entity: 'Category', entityId: category._id,
      after: categorySnapshot(category), ipAddress: req.ip,
    });
    return res.status(201).json({ success: true, category: categoryOutput(category) });
  } catch (error) {
    return handleError(error, next);
  }
}

async function updateCategory(req, res, next) {
  try {
    const current = await Category.findById(req.params.id);
    if (!current) throw statusError('Category not found', 404);
    const updates = { name: req.body.name, commissionEnabled: false };
    if (req.body.vatRate !== undefined) updates.vatRate = req.body.vatRate;
    if (req.body.commissionPercent !== undefined) updates.commissionPercent = req.body.commissionPercent;
    const category = await Category.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    await AuditLog.create({
      actorId: req.user._id, action: 'UPDATE', entity: 'Category', entityId: category._id,
      before: categorySnapshot(current), after: categorySnapshot(category), ipAddress: req.ip,
    });
    return res.json({ success: true, category: categoryOutput(category) });
  } catch (error) {
    return handleError(error, next);
  }
}

async function removeCategory(req, res, next) {
  try {
    const current = await Category.findById(req.params.id);
    if (!current) throw statusError('Category not found', 404);
    if (await Product.exists({ categoryId: current._id })) {
      throw statusError('Category is assigned to products and cannot be deleted', 409);
    }
    await Category.findByIdAndDelete(current._id);
    await AuditLog.create({
      actorId: req.user._id, action: 'DELETE', entity: 'Category', entityId: current._id,
      before: categorySnapshot(current), ipAddress: req.ip,
    });
    return res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    return handleError(error, next);
  }
}

async function listBrands(req, res, next) {
  try {
    const brands = await Brand.find().select('name logo.contentType createdAt updatedAt').sort({ name: 1 }).lean();
    return res.json({ success: true, brands: brands.map(brandOutput) });
  } catch (error) {
    return next(error);
  }
}

async function createBrand(req, res, next) {
  try {
    const brand = await Brand.create({
      name: req.body.name,
      ...(req.file ? { logo: { data: req.file.buffer, contentType: req.file.mimetype } } : {}),
    });
    await AuditLog.create({
      actorId: req.user._id, action: 'CREATE', entity: 'Brand', entityId: brand._id,
      after: snapshot(brand), metadata: { logoUploaded: Boolean(req.file) }, ipAddress: req.ip,
    });
    return res.status(201).json({ success: true, brand: brandOutput(brand) });
  } catch (error) {
    return handleError(error, next);
  }
}

async function updateBrand(req, res, next) {
  try {
    const current = await Brand.findById(req.params.id);
    if (!current) throw statusError('Brand not found', 404);
    const updates = { name: req.body.name };
    if (req.file) updates.logo = { data: req.file.buffer, contentType: req.file.mimetype };
    const brand = await Brand.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    await AuditLog.create({
      actorId: req.user._id, action: 'UPDATE', entity: 'Brand', entityId: brand._id,
      before: snapshot(current), after: snapshot(brand),
      metadata: { logoUploaded: Boolean(req.file) }, ipAddress: req.ip,
    });
    return res.json({ success: true, brand: brandOutput(brand) });
  } catch (error) {
    return handleError(error, next);
  }
}

async function removeBrand(req, res, next) {
  try {
    const current = await Brand.findById(req.params.id);
    if (!current) throw statusError('Brand not found', 404);
    if (await Product.exists({ brandId: current._id })) {
      throw statusError('Brand is assigned to products and cannot be deleted', 409);
    }
    await Brand.findByIdAndDelete(current._id);
    await AuditLog.create({
      actorId: req.user._id, action: 'DELETE', entity: 'Brand', entityId: current._id,
      before: snapshot(current), ipAddress: req.ip,
    });
    return res.json({ success: true, message: 'Brand deleted successfully' });
  } catch (error) {
    return handleError(error, next);
  }
}

async function getBrandLogo(req, res, next) {
  try {
    const brand = await Brand.findById(req.params.id).select('+logo.data');
    if (!brand?.logo?.data || !brand.logo.contentType) throw statusError('Brand logo not found', 404);
    res.type(brand.logo.contentType);
    res.set('Cache-Control', 'private, max-age=3600');
    return res.send(brand.logo.data);
  } catch (error) {
    return next(error);
  }
}

async function listUnits(req, res, next) {
  try {
    const units = await Unit.find().sort({ name: 1 }).lean();
    return res.json({ success: true, units: units.map(unitOutput) });
  } catch (error) {
    return next(error);
  }
}

async function createUnit(req, res, next) {
  try {
    const unit = await Unit.create({ name: req.body.name, abbreviation: req.body.abbreviation });
    await AuditLog.create({
      actorId: req.user._id, action: 'CREATE', entity: 'Unit', entityId: unit._id,
      after: snapshot(unit), ipAddress: req.ip,
    });
    return res.status(201).json({ success: true, unit: unitOutput(unit) });
  } catch (error) {
    return handleError(error, next);
  }
}

async function updateUnit(req, res, next) {
  try {
    const current = await Unit.findById(req.params.id);
    if (!current) throw statusError('Unit not found', 404);
    const unit = await Unit.findByIdAndUpdate(req.params.id, {
      name: req.body.name, abbreviation: req.body.abbreviation,
    }, { new: true, runValidators: true });
    await AuditLog.create({
      actorId: req.user._id, action: 'UPDATE', entity: 'Unit', entityId: unit._id,
      before: snapshot(current), after: snapshot(unit), ipAddress: req.ip,
    });
    return res.json({ success: true, unit: unitOutput(unit) });
  } catch (error) {
    return handleError(error, next);
  }
}

async function removeUnit(req, res, next) {
  try {
    const current = await Unit.findById(req.params.id);
    if (!current) throw statusError('Unit not found', 404);
    if (await Product.exists({ unitId: current._id })) {
      throw statusError('Unit is assigned to products and cannot be deleted', 409);
    }
    await Unit.findByIdAndDelete(current._id);
    await AuditLog.create({
      actorId: req.user._id, action: 'DELETE', entity: 'Unit', entityId: current._id,
      before: snapshot(current), ipAddress: req.ip,
    });
    return res.json({ success: true, message: 'Unit deleted successfully' });
  } catch (error) {
    return handleError(error, next);
  }
}

module.exports = {
  listCategories, createCategory, updateCategory, removeCategory,
  listBrands, createBrand, updateBrand, removeBrand, getBrandLogo,
  listUnits, createUnit, updateUnit, removeUnit,
};
