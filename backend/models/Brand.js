const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
}, { timestamps: true });

brandSchema.index({ createdAt: 1 });

module.exports = mongoose.models.Brand || mongoose.model('Brand', brandSchema);