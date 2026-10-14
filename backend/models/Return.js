const mongoose = require('mongoose');

const returnLineSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 0.000001 },
  amount: { type: Number, required: true, min: 0 },
}, { _id: false });

const returnSchema = new mongoose.Schema({
  returnNumber: { type: String, required: true, trim: true, unique: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  lines: { type: [returnLineSchema], required: true, validate: (lines) => lines.length > 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

returnSchema.index({ orderId: 1 });
returnSchema.index({ createdAt: 1 });

module.exports = mongoose.models.Return || mongoose.model('Return', returnSchema);