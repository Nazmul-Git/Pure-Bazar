const {
  AuditLog, Brand, Category, PriceHistory, Product, Settings, Unit, Vendor,
} = require('../models');

const editableFields = [
  'name', 'categoryId', 'brandId', 'unitId', 'unitValue', 'ownerType', 'vendorId',
  'vendorPrice', 'mrp', 'vatApplicable', 'vatRate',
];

function statusError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function handleError(error, next) {
  if (error.code === 11000) error.status = 409;
  if (error.name === 'ValidationError') {
    error.status = 400;
    error.errors = Object.entries(error.errors).map(([field, detail]) => ({
      field,
      message: detail.message,
    }));
  }
  return next(error);
}

function productData(product) {
  return product.toObject ? product.toObject() : product;
}

function productSnapshot(product) {
  const data = productData(product);
  return Object.fromEntries([
    'name', 'categoryId', 'brandId', 'unitId', 'unitValue', 'ownerType', 'vendorId',
    'vendorPrice', 'mrp', 'margin', 'vatApplicable', 'vatRate', 'barcode',
  ].filter((field) => data[field] !== undefined)
    .map((field) => [field, data[field]?.toString && field.endsWith('Id') ? data[field].toString() : data[field]]));
}

function productOutput(product, discountPercent) {
  const data = productData(product);
  const maximumDiscount = Math.round((data.mrp * discountPercent / 100 + Number.EPSILON) * 100) / 100;
  const result = productSnapshot(data);
  result.id = data._id.toString();
  result.marginWarning = data.margin < maximumDiscount;
  result.createdAt = data.createdAt;
  result.updatedAt = data.updatedAt;
  return result;
}

async function discountPercent() {
  const settings = await Settings.findOne({ singleton: 'global' }).lean();
  return settings?.shareholderDiscountPercent ?? 5;
}

async function validateReferences(data) {
  const checks = [
    [Category, data.categoryId, 'Category'],
    [Unit, data.unitId, 'Unit'],
    [Brand, data.brandId, 'Brand'],
  ];
  for (const [Model, id, label] of checks) {
    if (id && !(await Model.exists({ _id: id }))) {
      throw statusError(`${label} not found`, 400);
    }
  }

  if (data.ownerType === 'VENDOR') {
    if (!data.vendorId) throw statusError('Vendor-owned products require a vendor', 400);
    if (!(await Vendor.exists({ _id: data.vendorId }))) throw statusError('Vendor not found', 400);
  } else if (data.vendorId) {
    throw statusError('Company-owned products cannot have a vendor', 400);
  }
}

function pickInput(body) {
  return Object.fromEntries(editableFields
    .filter((field) => Object.prototype.hasOwnProperty.call(body, field))
    .map((field) => [field, body[field]]));
}

async function listProducts(req, res, next) {
  try {
    const [products, percent] = await Promise.all([
      Product.find().sort({ name: 1 }).lean(),
      discountPercent(),
    ]);
    return res.json({
      success: true,
      products: products.map((product) => productOutput(product, percent)),
      marginWarningPercent: percent,
    });
  } catch (error) {
    return next(error);
  }
}

async function getProduct(req, res, next) {
  try {
    const [product, percent] = await Promise.all([
      Product.findById(req.params.id).lean(),
      discountPercent(),
    ]);
    if (!product) throw statusError('Product not found', 404);
    return res.json({ success: true, product: productOutput(product, percent) });
  } catch (error) {
    return next(error);
  }
}

async function createProduct(req, res, next) {
  try {
    const input = pickInput(req.body);
    await validateReferences(input);
    const product = await Product.create(input);
    const after = productSnapshot(product);
    await AuditLog.create({
      actorId: req.user._id,
      action: 'CREATE',
      entity: 'Product',
      entityId: product._id,
      after,
      ipAddress: req.ip,
    });
    return res.status(201).json({
      success: true,
      product: productOutput(product, await discountPercent()),
    });
  } catch (error) {
    return handleError(error, next);
  }
}

async function updateProduct(req, res, next) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) throw statusError('Product not found', 404);

    const before = productSnapshot(product);
    const input = pickInput(req.body);
    if (!Object.keys(input).length) throw statusError('At least one product field must be supplied', 400);
    const changesPrice = ['vendorPrice', 'mrp'].some((field) => (
      Object.prototype.hasOwnProperty.call(input, field) && input[field] !== product[field]
    ));
    const nextValues = { ...productData(product), ...input };
    await validateReferences(nextValues);
    product.set(input);
    await product.save();

    const after = productSnapshot(product);
    if (changesPrice) {
      await PriceHistory.create({
        productId: product._id,
        oldVendorPrice: before.vendorPrice,
        newVendorPrice: after.vendorPrice,
        oldMrp: before.mrp,
        newMrp: after.mrp,
        changedBy: req.user._id,
        ...(req.body.reason ? { reason: req.body.reason } : {}),
      });
    }
    await AuditLog.create({
      actorId: req.user._id,
      action: 'UPDATE',
      entity: 'Product',
      entityId: product._id,
      before,
      after,
      ...(changesPrice ? { metadata: { priceChanged: true } } : {}),
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      product: productOutput(product, await discountPercent()),
    });
  } catch (error) {
    return handleError(error, next);
  }
}

module.exports = { listProducts, getProduct, createProduct, updateProduct };
