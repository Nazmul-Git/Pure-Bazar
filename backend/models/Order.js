const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  method: { type: String, enum: ['CASH', 'BKASH', 'NAGAD', 'CARD', 'WALLET'], required: true },
  amount: { type: Number, required: true, min: 0 },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, trim: true, unique: true },
  channel: { type: String, enum: ['POS'], default: 'POS', required: true },
  subtotal: { type: Number, required: true, min: 0 },
  otherDiscountAmount: { type: Number, default: 0, min: 0 },
  otherDiscountReason: { type: String, trim: true },
  shareholderDiscountAmount: { type: Number, default: 0, min: 0 },
  vatAmount: { type: Number, default: 0, min: 0 },
  grandTotal: { type: Number, required: true, min: 0 },
  payments: { type: [paymentSchema], required: true, validate: (payments) => payments.length > 0 },
  paymentStatus: { type: String, enum: ['PAID', 'REFUNDED'], required: true },
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shareholder' },
  cashier: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  outlet: { type: mongoose.Schema.Types.ObjectId, required: true },
}, { timestamps: true });

orderSchema.pre('validate', function requireDiscountReason() {
  if (this.otherDiscountAmount > 0 && !this.otherDiscountReason) {
    this.invalidate('otherDiscountReason', 'A reason is required for other discounts');
  }
});

orderSchema.index({ memberId: 1 });
orderSchema.index({ createdAt: 1 });

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);