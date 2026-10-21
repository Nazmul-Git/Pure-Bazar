const mongoose = require('mongoose');

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

const salaryLineSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  baseSalary: { type: Number, required: true, min: 0, set: roundMoney },
  allowances: { type: Number, min: 0, default: 0, set: roundMoney },
  deductions: { type: Number, min: 0, default: 0, set: roundMoney },
  advanceDeduction: { type: Number, min: 0, default: 0, set: roundMoney },
  otherDeductions: { type: Number, min: 0, default: 0, set: roundMoney },
  advanceIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  netAmount: { type: Number, min: 0, set: roundMoney },
});

const salarySheetSchema = new mongoose.Schema({
  month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
  status: { type: String, enum: ['Draft', 'Approved', 'Paid'], default: 'Draft', required: true },
  lines: { type: [salaryLineSchema], required: true, validate: (lines) => lines.length > 0 },
  totalAmount: { type: Number, min: 0, default: 0, set: roundMoney },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  paidAt: { type: Date },
  expenseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense' },
}, { timestamps: true });

salarySheetSchema.pre('validate', function calculatePayroll() {
  let totalAmount = 0;
  for (const line of this.lines) {
    if (line.advanceDeduction || line.otherDeductions) {
      line.deductions = roundMoney(line.advanceDeduction + line.otherDeductions);
    }
    line.netAmount = roundMoney(line.baseSalary + line.allowances - line.deductions);
    totalAmount += line.netAmount;
  }
  this.totalAmount = roundMoney(totalAmount);
  if (['Approved', 'Paid'].includes(this.status) && !this.approvedBy) {
    this.invalidate('approvedBy', 'Approver is required for an approved salary sheet');
  }
  if (this.status === 'Paid') {
    if (!this.paidBy) this.invalidate('paidBy', 'Payer is required for a paid salary sheet');
    if (!this.paidAt) this.invalidate('paidAt', 'Payment date is required for a paid salary sheet');
    if (!this.expenseId) this.invalidate('expenseId', 'Expense is required for a paid salary sheet');
  }
});

salarySheetSchema.pre('save', async function preventEditingPaidMonth() {
  if (this.isNew) return;
  const existing = await this.constructor.findById(this._id).select('status').lean();
  if (existing?.status === 'Paid' && this.isModified()) {
    throw new Error('Paid salary sheets are closed and cannot be edited');
  }
});

salarySheetSchema.index({ month: 1 }, { unique: true });
salarySheetSchema.index({ status: 1, month: -1 });

module.exports = mongoose.models.SalarySheet || mongoose.model('SalarySheet', salarySheetSchema);