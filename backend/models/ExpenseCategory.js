const mongoose = require('mongoose');

const expenseCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, unique: true },
  description: { type: String, trim: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

expenseCategorySchema.index({ createdAt: 1 });

module.exports = mongoose.models.ExpenseCategory || mongoose.model('ExpenseCategory', expenseCategorySchema);