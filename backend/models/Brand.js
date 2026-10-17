const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  logo: {
    data: { type: Buffer, select: false },
    contentType: { type: String, enum: ['image/png', 'image/jpeg', 'image/webp'] },
  },
}, { timestamps: true });

brandSchema.index({ createdAt: 1 });

module.exports = mongoose.models.Brand || mongoose.model('Brand', brandSchema);