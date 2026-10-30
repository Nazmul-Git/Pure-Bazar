const mongoose = require('mongoose');

const requiredString = { type: String, required: true, trim: true };
const documentSchema = new mongoose.Schema({
  fileName: requiredString,
  originalName: { type: String, trim: true },
  mimeType: { type: String, trim: true },
  size: { type: Number },
}, { _id: false });

const vendorRegistrationSchema = new mongoose.Schema({
  businessLegalIdentity: {
    companyName: requiredString,
    tradeLicenseNo: requiredString,
    tradeLicenseExpiry: { type: Date, required: true },
    businessType: {
      type: String,
      enum: ['Proprietorship', 'Partnership', 'Private Limited', 'Cooperative'],
      required: true,
    },
    tinNumber: { type: String, trim: true },
    vatBinNumber: { type: String, trim: true },
    ownerInfo: {
      fullNameEng: requiredString,
      fullNameBen: { type: String, trim: true },
      nidNumber: requiredString,
      dob: { type: Date },
      presentAddress: { type: String, trim: true },
      permanentAddress: { type: String, trim: true },
    },
  },
  operationalAndWarehouseLogistics: {
    warehouseAddress: requiredString,
    primaryContactPerson: requiredString,
    dispatchMobile: requiredString,
    productCategories: { type: [String], default: [] },
    deliveryLeadTimeHours: { type: Number, min: 0 },
  },
  documents: {
    tradeLicense: { type: documentSchema, required: true },
    ownerNid: { type: documentSchema, required: true },
  },
  payoutPreferences: {
    note: { type: String, default: 'Flexible payout managed on demand' },
  },
  verificationStatus: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING',
    required: true,
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

vendorRegistrationSchema.index({ verificationStatus: 1, createdAt: -1 });

module.exports = mongoose.models.VendorRegistration
  || mongoose.model('VendorRegistration', vendorRegistrationSchema);
