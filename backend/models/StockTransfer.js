const mongoose = require('mongoose');

const stockTransferLineSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  requestedQuantity: { type: Number, required: true, min: 0.000001 },
  dispatchedQuantity: { type: Number, min: 0 },
  receivedQuantity: { type: Number, min: 0 },
  discrepancyQuantity: { type: Number, min: 0 },
});

const stockTransferSchema = new mongoose.Schema({
  fromWarehouseId: { type: mongoose.Schema.Types.ObjectId, required: true },
  toWarehouseId: { type: mongoose.Schema.Types.ObjectId, required: true },
  status: { type: String, enum: ['Requested', 'Dispatched', 'Received', 'Discrepancy'], default: 'Requested' },
  lines: { type: [stockTransferLineSchema], required: true, validate: (lines) => lines.length > 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dispatchedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  dispatchedAt: { type: Date },
  receivedAt: { type: Date },
}, { timestamps: true });

stockTransferSchema.index({ fromWarehouseId: 1, status: 1, createdAt: -1 });
stockTransferSchema.index({ toWarehouseId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.models.StockTransfer || mongoose.model('StockTransfer', stockTransferSchema);