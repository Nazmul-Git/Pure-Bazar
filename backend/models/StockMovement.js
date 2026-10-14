const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, required: true },
  quantity: { type: Number, required: true, min: 0.000001 },
  type: {
    type: String,
    enum: ['GRN', 'SALE', 'RETURN', 'TRANSFER_OUT', 'TRANSFER_IN', 'ADJUSTMENT', 'COUNT'],
    required: true,
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, trim: true },
  referenceId: { type: mongoose.Schema.Types.ObjectId },
  referenceType: { type: String, trim: true },
}, { timestamps: true });

stockMovementSchema.index({ createdAt: 1 });

module.exports = mongoose.models.StockMovement || mongoose.model('StockMovement', stockMovementSchema);