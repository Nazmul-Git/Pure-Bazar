const mongoose = require('mongoose');

const vendorLedgerSchema = new mongoose.Schema({
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  returnId: { type: mongoose.Schema.Types.ObjectId, ref: 'Return' },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 0.000001 },
  entryType: { type: String, enum: ['SALE', 'RETURN'], required: true },
  vendorPayable: { type: Number, required: true, min: 0 },
  companyNet: { type: Number, required: true },
}, { timestamps: true });

vendorLedgerSchema.index({ vendorId: 1 });
vendorLedgerSchema.index({ createdAt: 1 });

module.exports = mongoose.models.VendorLedger || mongoose.model('VendorLedger', vendorLedgerSchema);