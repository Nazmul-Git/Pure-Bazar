const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  type: { type: String, enum: ['CENTRAL', 'OUTLET'], required: true },
  name: { type: String, required: true, trim: true },
}, { timestamps: true });

locationSchema.index({ type: 1, name: 1 }, { unique: true });

module.exports = mongoose.models.Location || mongoose.model('Location', locationSchema);
