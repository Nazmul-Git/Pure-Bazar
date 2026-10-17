const mongoose = require('mongoose');
const { generateEan13Barcode, generateSku, isValidEan13 } = require('../utils/productIdentifiers');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand' },
  unitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
  ownerType: { type: String, enum: ['COMPANY', 'VENDOR'], required: true },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  vendorPrice: { type: Number, required: true, min: 0 },
  mrp: { type: Number, required: true, min: 0 },
  margin: { type: Number, min: 0 },
  vatApplicable: { type: Boolean, default: false },
  vatRate: { type: Number, min: 0, max: 100 },
  barcode: {
    type: String,
    trim: true,
    default: generateEan13Barcode,
    validate: {
      validator: isValidEan13,
      message: 'Barcode must be a valid EAN-13 number',
    },
  },
  sku: {
    type: String,
    trim: true,
    default() {
      return generateSku(this.barcode);
    },
  },
  listedOnline: { type: Boolean, default: false },
}, { timestamps: true });

productSchema.pre('validate', function calculateMargin() {
  if (Number.isFinite(this.mrp) && Number.isFinite(this.vendorPrice)) {
    this.margin = Math.round((this.mrp - this.vendorPrice + Number.EPSILON) * 100) / 100;
  }
  if (this.ownerType === 'VENDOR' && !this.vendorId) {
    this.invalidate('vendorId', 'Vendor-owned products require a vendor');
  }
});

productSchema.path('mrp').validate(function validateMrp(value) {
  return !Number.isFinite(this.vendorPrice) || value >= this.vendorPrice;
}, 'MRP must be greater than or equal to vendor price');

productSchema.index({ barcode: 1 }, { unique: true, sparse: true });
productSchema.index({ sku: 1 }, { unique: true, sparse: true });
productSchema.index({ vendorId: 1 });
productSchema.index({ createdAt: 1 });

module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);