const mongoose = require('mongoose');

const stockAdjustmentLineSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: {
    type: Number,
    required: true,
    validate: { validator: (quantity) => Number.isFinite(quantity) && quantity !== 0, message: 'Adjustment quantity cannot be zero' },
  },
});

const stockAdjustmentSchema = new mongoose.Schema({
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
  reason: { type: String, required: true, trim: true },
  status: { type: String, enum: ['Draft', 'Pending', 'Approved', 'Rejected'], default: 'Pending' },
  lines: { type: [stockAdjustmentLineSchema], required: true, validate: (lines) => lines.length > 0 },
  value: { type: Number, required: true, min: 0 },
  approvalLimit: { type: Number, required: true, min: 0 },
  stockCountId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockCount' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

stockAdjustmentSchema.index({ createdAt: 1 });
stockAdjustmentSchema.index({ stockCountId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.models.StockAdjustment || mongoose.model('StockAdjustment', stockAdjustmentSchema);