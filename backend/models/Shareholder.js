const mongoose = require('mongoose');

const shareholderSchema = new mongoose.Schema({
  memberId: { type: String, required: true, trim: true, unique: true },
  name: { type: String, required: true, trim: true },
  mobile: {
    type: String,
    required() { return this.verified; },
    trim: true,
  },
  verified: { type: Boolean, required: true },
  active: { type: Boolean, required: true },
  walletEnabled: { type: Boolean, required: true },
}, { timestamps: true });

shareholderSchema.index({ createdAt: 1 });

module.exports = mongoose.models.Shareholder || mongoose.model('Shareholder', shareholderSchema);