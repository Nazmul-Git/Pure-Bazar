const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  fileName: { type: String, required: true },
  originalName: { type: String },
  mimeType: { type: String, required: true },
  size: { type: Number },
}, { _id: false });

const expenseSchema = new mongoose.Schema({
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExpenseCategory', required: true },
  amount: { type: Number, required: true, min: 0, set: (value) => Number(Number(value).toFixed(2)) },
  expenseDate: { type: Date, required: true, default: Date.now },
  description: { type: String, required: true, trim: true },
  paymentMethod: { type: String, enum: ['Cash', 'Bank', 'bKash', 'Nagad', 'Card'], required: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
  attachment: { type: attachmentSchema, default: undefined },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sourceType: { type: String, enum: ['MANUAL', 'SALARY_SHEET'], default: 'MANUAL', required: true },
  sourceId: { type: mongoose.Schema.Types.ObjectId },
}, { timestamps: true });

expenseSchema.pre('validate', function validateExpenseSource() {
  if (this.sourceType === 'SALARY_SHEET' && !this.sourceId) {
    this.invalidate('sourceId', 'Salary sheet is required for payroll expenses');
  }
});

expenseSchema.index({ categoryId: 1, expenseDate: -1 });
expenseSchema.index({ createdAt: 1 });
expenseSchema.index({ sourceType: 1, sourceId: 1 }, {
  unique: true,
  partialFilterExpression: { sourceType: 'SALARY_SHEET' },
});

module.exports = mongoose.models.Expense || mongoose.model('Expense', expenseSchema);