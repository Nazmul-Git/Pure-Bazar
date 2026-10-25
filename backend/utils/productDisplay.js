const { Unit } = require('../models');

function formatDisplayName(name, unitLabel) {
  return unitLabel ? `${name} [${unitLabel}]` : name;
}

// Resolves unit abbreviations for products so UI names can show them without changing stored names.
async function unitLabelMap(products) {
  const ids = [...new Set(products.map((product) => product.unitId?.toString()).filter(Boolean))];
  if (!ids.length) return new Map();
  const units = await Unit.find({ _id: { $in: ids } }).select('name abbreviation').lean();
  return new Map(units.map((unit) => [unit._id.toString(), unit.abbreviation || unit.name]));
}

function displayFields(product, labels) {
  const unitLabel = labels.get(product.unitId?.toString()) || null;
  return { unitLabel, displayName: formatDisplayName(product.name, unitLabel) };
}

module.exports = { formatDisplayName, unitLabelMap, displayFields };
