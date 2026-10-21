const mongoose = require('mongoose');

const walletReconciliationSchema = new mongoose.Schema({
  businessDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
  orderNumber: { type: String, required: true, trim: true },
  memberId: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0.01 },
  status: { type: String, enum: ['Pending', 'Matched', 'Mismatch'], default: 'Pending', required: true },
  mismatchType: { type: String, enum: ['MISSING', 'AMOUNT_MISMATCH'] },
  probashiTransactionId: { type: String, trim: true },
  probashiAmount: { type: Number, min: 0 },
  checkedAt: { type: Date },
  resolved: { type: Boolean, default: false },
  resolutionReason: { type: String, trim: true },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: { type: Date },
}, { timestamps: true });

walletReconciliationSchema.index({ businessDate: 1, status: 1 });

module.exports = mongoose.models.WalletReconciliation
  || mongoose.model('WalletReconciliation', walletReconciliationSchema);
