const mongoose = require('mongoose');

const warehouseStockSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, required: true },
  quantity: { type: Number, required: true, default: 0, min: 0 },
}, { timestamps: true });

warehouseStockSchema.index({ productId: 1, warehouseId: 1 }, { unique: true });
warehouseStockSchema.index({ createdAt: 1 });

module.exports = mongoose.models.WarehouseStock || mongoose.model('WarehouseStock', warehouseStockSchema);