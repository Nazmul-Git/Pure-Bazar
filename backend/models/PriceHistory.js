const mongoose = require('mongoose');

const priceHistorySchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  oldVendorPrice: { type: Number, min: 0 },
  newVendorPrice: { type: Number, min: 0 },
  oldMrp: { type: Number, min: 0 },
  newMrp: { type: Number, min: 0 },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, trim: true },
}, { timestamps: true });

priceHistorySchema.index({ createdAt: 1 });

module.exports = mongoose.models.PriceHistory || mongoose.model('PriceHistory', priceHistorySchema);