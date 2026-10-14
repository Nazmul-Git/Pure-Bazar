const mongoose = require('mongoose');

const stockAdjustmentLineSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 0.000001 },
});

const stockAdjustmentSchema = new mongoose.Schema({
  warehouseId: { type: mongoose.Schema.Types.ObjectId, required: true },
  reason: { type: String, required: true, trim: true },
  status: { type: String, enum: ['Draft', 'Pending', 'Approved', 'Rejected'], default: 'Pending' },
  lines: { type: [stockAdjustmentLineSchema], required: true, validate: (lines) => lines.length > 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

stockAdjustmentSchema.index({ createdAt: 1 });

module.exports = mongoose.models.StockAdjustment || mongoose.model('StockAdjustment', stockAdjustmentSchema);