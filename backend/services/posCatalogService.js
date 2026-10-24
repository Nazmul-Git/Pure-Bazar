const mongoose = require('mongoose');
const { Product, StockMovement } = require('../models');
const { statusError } = require('./posBillService');
const { resolveOutlet } = require('./posCheckoutService');

async function stockByProduct(outletId, productIds) {
  if (!productIds.length) return new Map();
  const rows = await StockMovement.aggregate([
    {
      $match: {
        warehouseId: new mongoose.Types.ObjectId(String(outletId)),
        productId: { $in: productIds.map((id) => new mongoose.Types.ObjectId(String(id))) },
      },
    },
    { $group: { _id: '$productId', quantity: { $sum: '$quantity' } } },
  ]);
  return new Map(rows.map((row) => [row._id.toString(), Math.max(0, row.quantity)]));
}

function toItem(product, stock) {
  return {
    productId: product._id,
    name: product.name,
    barcode: product.barcode,
    mrp: product.mrp,
    vendorPrice: product.vendorPrice,
    stock: stock.get(String(product._id)) || 0,
  };
}

async function scanItem(req, res, next) {
  try {
    const product = await Product.findOne({ barcode: req.params.barcode }).lean();
    if (!product) throw statusError('Product barcode was not found', 404);
    const outletId = await resolveOutlet(req.query, req.user);
    const stock = await stockByProduct(outletId, [product._id]);
    return res.json({ success: true, item: toItem(product, stock) });
  } catch (error) {
    return next(error);
  }
}

async function searchItems(req, res, next) {
  try {
    const term = String(req.query.q || '').trim();
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    const products = await Product.find({
      $or: [{ name: regex }, { barcode: regex }, { sku: regex }],
    }).sort({ name: 1 }).limit(10).lean();
    const outletId = await resolveOutlet(req.query, req.user);
    const stock = await stockByProduct(outletId, products.map((product) => product._id));
    return res.json({ success: true, items: products.map((product) => toItem(product, stock)) });
  } catch (error) {
    return next(error);
  }
}

module.exports = { scanItem, searchItems };
