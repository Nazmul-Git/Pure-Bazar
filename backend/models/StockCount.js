const mongoose = require('mongoose');

const stockCountLineSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  expectedQuantity: { type: Number, required: true, min: 0 },
  countedQuantity: { type: Number, min: 0 },
  difference: { type: Number },
});

stockCountLineSchema.pre('validate', function calculateDifference() {
  if (Number.isFinite(this.expectedQuantity) && Number.isFinite(this.countedQuantity)) {
    this.difference = this.countedQuantity - this.expectedQuantity;
  }
});

const stockCountSchema = new mongoose.Schema({
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
  reason: { type: String, required: true, trim: true },
  status: { type: String, enum: ['Draft', 'Counting', 'PendingApproval', 'Posted', 'Rejected'], default: 'Draft' },
  lines: { type: [stockCountLineSchema], required: true, validate: (lines) => lines.length > 0 },
  stockAdjustmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockAdjustment' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

stockCountSchema.index({ createdAt: 1 });

module.exports = mongoose.models.StockCount || mongoose.model('StockCount', stockCountSchema);