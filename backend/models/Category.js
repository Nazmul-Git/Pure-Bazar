const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  vatRate: { type: Number, min: 0, max: 100 },
  commissionPercent: { type: Number, min: 0, max: 100 },
  commissionEnabled: { type: Boolean, default: false },
}, { timestamps: true });

categorySchema.index({ createdAt: 1 });

module.exports = mongoose.models.Category || mongoose.model('Category', categorySchema);