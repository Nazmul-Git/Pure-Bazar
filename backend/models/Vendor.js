const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  memberId: { type: String, required: true, trim: true, unique: true },
  name: { type: String, required: true, trim: true },
  applicantNameBn: { type: String, trim: true, maxlength: 150 },
  fatherName: { type: String, trim: true, maxlength: 150 },
  motherName: { type: String, trim: true, maxlength: 150 },
  dateOfBirth: { type: Date },
  nationality: { type: String, trim: true, default: 'Bangladeshi', maxlength: 100 },
  nidOrPassportNumber: { type: String, trim: true, maxlength: 50 },
  presentAddress: { type: String, trim: true, maxlength: 500 },
  permanentAddress: { type: String, trim: true, maxlength: 500 },
  mobile: { type: String, required: true, trim: true },
  emergencyContact: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true, maxlength: 254 },
  shopName: { type: String, required: true, trim: true },
  tradeLicenseNumber: { type: String, trim: true, maxlength: 100 },
  address: { type: String, required: true, trim: true },
  productCategory: { type: String, required: true, trim: true },
  payoutMethod: { type: String, enum: ['Cash', 'Bank', 'bKash', 'Nagad'] },
  accountDetails: { type: String, trim: true },
  termsAccepted: { type: Boolean, required: true, validate: (accepted) => accepted === true },
  termsVersion: { type: String, required: true, trim: true },
  status: { type: String, enum: ['Active', 'Suspended', 'Closed'], default: 'Active', required: true },
}, { timestamps: true });

vendorSchema.index({ createdAt: 1 });

module.exports = mongoose.models.Vendor || mongoose.model('Vendor', vendorSchema);