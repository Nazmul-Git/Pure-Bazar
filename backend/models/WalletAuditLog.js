const mongoose = require('mongoose');

const walletAuditLogSchema = new mongoose.Schema({
  memberId: { type: String, required: true, trim: true },
  action: {
    type: String,
    enum: ['MEMBER_VERIFY', 'WALLET_BALANCE_CHECK', 'TRANSACTION_REPORT', 'REFUND'],
    required: true,
  },
  succeeded: { type: Boolean, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

walletAuditLogSchema.index({ memberId: 1 });
walletAuditLogSchema.index({ createdAt: 1 });

module.exports = mongoose.models.WalletAuditLog || mongoose.model('WalletAuditLog', walletAuditLogSchema);