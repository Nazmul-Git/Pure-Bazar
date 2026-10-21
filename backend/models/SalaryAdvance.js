const mongoose = require('mongoose');

const salaryAdvanceSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  amount: { type: Number, required: true, min: 0, set: (value) => Number(Number(value).toFixed(2)) },
  requestedAt: { type: Date, default: Date.now, required: true },
  reason: { type: String, required: true, trim: true },
  status: { type: String, enum: ['Draft', 'Approved', 'Paid', 'Rejected'], default: 'Draft', required: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  paidAt: { type: Date },
  deductedSheetId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalarySheet' },
  deductedMonth: { type: String },
}, { timestamps: true });

salaryAdvanceSchema.pre('validate', function validateAdvanceStatus() {
  if (['Approved', 'Paid'].includes(this.status) && !this.approvedBy) {
    this.invalidate('approvedBy', 'Approver is required for an approved advance');
  }
  if (this.status === 'Paid') {
    if (!this.paidBy) this.invalidate('paidBy', 'Payer is required for a paid advance');
    if (!this.paidAt) this.invalidate('paidAt', 'Payment date is required for a paid advance');
  }
});

salaryAdvanceSchema.index({ employeeId: 1, requestedAt: -1 });
salaryAdvanceSchema.index({ status: 1 });

module.exports = mongoose.models.SalaryAdvance || mongoose.model('SalaryAdvance', salaryAdvanceSchema);