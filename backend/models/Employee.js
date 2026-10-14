const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  employeeCode: { type: String, required: true, trim: true, unique: true },
  name: { type: String, required: true, trim: true },
  phone: { type: String, trim: true },
  email: { type: String, lowercase: true, trim: true },
  designation: { type: String, trim: true },
  department: { type: String, trim: true },
  baseSalary: { type: Number, required: true, min: 0, set: (value) => Number(Number(value).toFixed(2)) },
  hireDate: { type: Date, default: Date.now },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', required: true },
}, { timestamps: true });

employeeSchema.index({ name: 1 });
employeeSchema.index({ status: 1 });

module.exports = mongoose.models.Employee || mongoose.model('Employee', employeeSchema);