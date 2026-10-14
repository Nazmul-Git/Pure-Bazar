const mongoose = require('mongoose');

const discountLogSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  scope: { type: String, enum: ['ITEM', 'BILL'], required: true },
  discountType: { type: String, enum: ['PERCENT', 'FIXED'], required: true },
  amount: { type: Number, required: true, min: 0.01 },
  reason: { type: String, required: true, trim: true },
  appliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

discountLogSchema.index({ createdAt: 1 });

module.exports = mongoose.models.DiscountLog || mongoose.model('DiscountLog', discountLogSchema);