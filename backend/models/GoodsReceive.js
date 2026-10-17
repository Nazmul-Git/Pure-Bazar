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
  warehouseId: { type: mongoose.Schema.Types.ObjectId, required: true },
  vendorChallanNumber: { type: String, trim: true },
  status: { type: String, enum: ['Draft', 'Approved', 'Rejected'], default: 'Draft' },
  lines: { type: [goodsReceiveLineSchema], required: true, validate: (lines) => lines.length > 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

goodsReceiveSchema.pre('validate', function validateOwnershipAndLines() {
  if (this.ownerType === 'VENDOR' && !this.vendorId) {
    this.invalidate('vendorId', 'Vendor purchases require a vendor');
  }
  if (this.ownerType === 'COMPANY' && this.vendorId) {
    this.invalidate('vendorId', 'Company purchases cannot have a vendor');
  }
  if (this.ownerType === 'VENDOR' && !this.vendorChallanNumber) {
    this.invalidate('vendorChallanNumber', 'Vendor purchases require a challan number');
  }
  const productIds = this.lines.map((line) => line.productId?.toString());
  if (new Set(productIds).size !== productIds.length) {
    this.invalidate('lines', 'A product can only appear once on a goods receive');
  }
});

goodsReceiveSchema.index({ vendorId: 1 });
goodsReceiveSchema.index({ createdAt: 1 });

module.exports = mongoose.models.GoodsReceive || mongoose.model('GoodsReceive', goodsReceiveSchema);