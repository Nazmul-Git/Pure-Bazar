const mongoose = require('mongoose');

const vendorTermSchema = new mongoose.Schema({
  version: { type: String, required: true, trim: true },
  terms: { type: String, required: true, trim: true },
  effectiveFrom: { type: Date, required: true },
}, { _id: false });

const settingsSchema = new mongoose.Schema({
  singleton: { type: String, default: 'global', unique: true, immutable: true },
  shareholderDiscountPercent: { type: Number, min: 0, max: 100, default: 5 },
  stockAdjustmentApprovalLimit: { type: Number, min: 0, default: 0 },
  vatEnabled: { type: Boolean, default: false },
  defaultVatRate: { type: Number, min: 0, max: 100, default: 0 },
  vatPriceMode: { type: String, enum: ['INCLUDED', 'EXCLUDED'], default: 'EXCLUDED' },
  vatCalculationOrder: { type: String, enum: ['DISCOUNT_THEN_VAT', 'VAT_THEN_DISCOUNT'], default: 'DISCOUNT_THEN_VAT' },
  discountLimitByRole: { type: Map, of: Number, default: {} },
  enabledPaymentMethods: { type: [String], enum: ['Cash', 'Bank', 'bKash', 'Nagad', 'Card', 'Wallet'], default: ['Cash', 'Bank', 'bKash', 'Nagad'] },
  receiptLayout: { type: mongoose.Schema.Types.Mixed, default: {} },
  vendorTerms: { type: [vendorTermSchema], default: [] },
  probashiStatus: { type: String, enum: ['NotConfigured', 'Active', 'Inactive'], default: 'NotConfigured' },
  vendorSettlementCyclePerMonth: { type: Number, enum: [1, 2], default: 1 },
  vendorPayoutCutoffDates: {
    type: [{ type: Number, min: 1, max: 31, validate: Number.isInteger }],
    default: [],
    validate: {
      validator: (dates) => new Set(dates).size === dates.length,
      message: 'Vendor payout cut-off dates must be unique',
    },
  },
  enabledVendorPayoutMethods: { type: [String], enum: ['Cash', 'Bank', 'bKash', 'Nagad'], default: ['Cash', 'Bank', 'bKash', 'Nagad'] },
  commissionEnabled: { type: Boolean, default: false },
  vendorWalletPayoutEnabled: { type: Boolean, default: false },
  outlets: { type: [mongoose.Schema.Types.Mixed], default: [] },
}, { timestamps: true });

module.exports = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);