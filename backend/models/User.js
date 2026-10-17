const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

userSchema.index({ createdAt: 1 });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);