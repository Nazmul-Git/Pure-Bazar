const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  abbreviation: { type: String, required: true, trim: true },
}, { timestamps: true });

unitSchema.index({ createdAt: 1 });

module.exports = mongoose.models.Unit || mongoose.model('Unit', unitSchema);