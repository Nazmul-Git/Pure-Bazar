const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  abbreviation: { type: String, required: true, trim: true },
}, { timestamps: true });

unitSchema.index({ createdAt: 1 });
unitSchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.models.Unit || mongoose.model('Unit', unitSchema);