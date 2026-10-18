const mongoose = require('mongoose');

const paymentSummarySchema = new mongoose.Schema({
  method: { type: String, enum: ['Cash', 'Bank', 'bKash', 'Nagad', 'Card', 'Wallet'], required: true },
  expectedAmount: { type: Number, min: 0, default: 0 },
  actualAmount: { type: Number, min: 0, default: 0 },
}, { _id: false });

const shiftSchema = new mongoose.Schema({
  outletId: { type: mongoose.Schema.Types.ObjectId, required: true },
  cashierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  openedAt: { type: Date, default: Date.now, required: true },
  openingCash: { type: Number, min: 0, required: true },
  closedAt: { type: Date },
  closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  expectedCash: { type: Number, min: 0 },
  actualCash: { type: Number, min: 0 },
  cashDifference: { type: Number },
  paymentSummary: { type: [paymentSummarySchema], default: [] },
  status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN', required: true },
}, { timestamps: true });

shiftSchema.pre('validate', function calculateCashDifference() {
  if (Number.isFinite(this.expectedCash) && Number.isFinite(this.actualCash)) {
    this.cashDifference = Number((this.actualCash - this.expectedCash).toFixed(2));
  }
  if (this.status === 'CLOSED') {
    if (!this.closedAt) this.invalidate('closedAt', 'Close date is required for a closed shift');
    if (!this.closedBy) this.invalidate('closedBy', 'Closing user is required for a closed shift');
    if (!Number.isFinite(this.expectedCash)) this.invalidate('expectedCash', 'Expected cash is required for a closed shift');
    if (!Number.isFinite(this.actualCash)) this.invalidate('actualCash', 'Actual cash is required for a closed shift');
  }
});

shiftSchema.index({ outletId: 1, status: 1 });
shiftSchema.index({ cashierId: 1, openedAt: -1 });
shiftSchema.index({ cashierId: 1 }, {
  unique: true,
  partialFilterExpression: { status: 'OPEN' },
});

module.exports = mongoose.models.Shift || mongoose.model('Shift', shiftSchema);