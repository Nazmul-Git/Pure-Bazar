const mongoose = require('mongoose');

const walletLogSchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shareholder', required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  amount: { type: Number, required: true, min: 0.01 },
  type: { type: String, enum: ['DEBIT', 'REFUND'], required: true },
}, { timestamps: true });

walletLogSchema.index({ memberId: 1 });
walletLogSchema.index({ createdAt: 1 });

module.exports = mongoose.models.WalletLog || mongoose.model('WalletLog', walletLogSchema);