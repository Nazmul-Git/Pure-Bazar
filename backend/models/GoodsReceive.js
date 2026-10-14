const mongoose = require('mongoose');

const goodsReceiveLineSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  receivedQuantity: { type: Number, required: true, min: 0 },
  acceptedQuantity: { type: Number, required: true, min: 0 },
  rejectedQuantity: { type: Number, required: true, min: 0 },
});

goodsReceiveLineSchema.pre('validate', function validateLineQuantities() {
  if (this.acceptedQuantity + this.rejectedQuantity > this.receivedQuantity) {
    this.invalidate('acceptedQuantity', 'Accepted and rejected quantities cannot exceed received quantity');
  }
});

const goodsReceiveSchema = new mongoose.Schema({
  ownerType: { type: String, enum: ['COMPANY', 'VENDOR'], required: true },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  vendorChallanNumber: { type: String, trim: true },
  status: { type: String, enum: ['Draft', 'Approved', 'Rejected'], default: 'Draft' },
  lines: { type: [goodsReceiveLineSchema], required: true, validate: (lines) => lines.length > 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

goodsReceiveSchema.index({ vendorId: 1 });
goodsReceiveSchema.index({ createdAt: 1 });

module.exports = mongoose.models.GoodsReceive || mongoose.model('GoodsReceive', goodsReceiveSchema);