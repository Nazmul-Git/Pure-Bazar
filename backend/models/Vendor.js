const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  memberId: { type: String, required: true, trim: true, unique: true },
  name: { type: String, required: true, trim: true },
  mobile: { type: String, required: true, trim: true },
  shopName: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  productCategory: { type: String, required: true, trim: true },
  payoutMethod: { type: String, enum: ['Cash', 'Bank', 'bKash', 'Nagad'], required: true },
  accountDetails: { type: String, required: true, trim: true },
  termsAccepted: { type: Boolean, required: true, validate: (accepted) => accepted === true },
  termsVersion: { type: String, required: true, trim: true },
  status: { type: String, enum: ['Active', 'Suspended', 'Closed'], default: 'Active', required: true },
}, { timestamps: true });

vendorSchema.index({ createdAt: 1 });

module.exports = mongoose.models.Vendor || mongoose.model('Vendor', vendorSchema);