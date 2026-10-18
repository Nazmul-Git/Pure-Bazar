const mongoose = require('mongoose');

const returnLineSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 0.000001 },
  amount: { type: Number, required: true, min: 0 },
}, { _id: false });

const returnSchema = new mongoose.Schema({
  returnNumber: { type: String, required: true, trim: true, unique: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  lines: { type: [returnLineSchema], required: true, validate: (lines) => lines.length > 0 },
  refundAmount: { type: Number, required: true, min: 0 },
  walletRefunded: { type: Boolean, default: false },
  walletRefundMethod: { type: String, enum: ['MANUAL', 'API'] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

returnSchema.index({ orderId: 1 }, { unique: true });
returnSchema.index({ createdAt: 1 });

returnSchema.pre('validate', function validateWalletRefund() {
  if (this.walletRefunded && !this.walletRefundMethod) {
    this.invalidate('walletRefundMethod', 'A wallet refund method is required when refunded');
  }
  if (!this.walletRefunded && this.walletRefundMethod) {
    this.invalidate('walletRefundMethod', 'A wallet refund method requires walletRefunded');
  }
});

module.exports = mongoose.models.Return || mongoose.model('Return', returnSchema);