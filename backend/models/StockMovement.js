const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
  quantity: {
    type: Number,
    required: true,
    validate: { validator: (quantity) => Number.isFinite(quantity) && quantity !== 0, message: 'Movement quantity cannot be zero' },
  },
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

stockMovementSchema.pre('validate', function validateMovementDirection() {
  const incomingTypes = ['GRN', 'RETURN', 'TRANSFER_IN'];
  const outgoingTypes = ['SALE', 'TRANSFER_OUT'];
  if (incomingTypes.includes(this.type) && this.quantity < 0) {
    this.invalidate('quantity', 'Incoming movements must have a positive quantity');
  }
  if (outgoingTypes.includes(this.type) && this.quantity > 0) {
    this.invalidate('quantity', 'Outgoing movements must have a negative quantity');
  }
});

stockMovementSchema.index({ createdAt: 1 });

module.exports = mongoose.models.StockMovement || mongoose.model('StockMovement', stockMovementSchema);