const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  type: { type: String, enum: ['CENTRAL', 'OUTLET'], required: true },
  name: { type: String, required: true, trim: true },
}, { timestamps: true });

locationSchema.index({ type: 1, name: 1 }, { unique: true });
locationSchema.statics.ensureCentralWarehouse = function ensureCentralWarehouse() {
  const centralWarehouse = { type: 'CENTRAL', name: 'Central Warehouse' };
  return this.findOneAndUpdate(
    centralWarehouse,
    { $setOnInsert: centralWarehouse },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );
};

module.exports = mongoose.models.Location || mongoose.model('Location', locationSchema);
