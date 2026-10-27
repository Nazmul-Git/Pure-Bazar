const { Unit } = require('../models');

function formatDisplayName(name, unitLabel) {
  return unitLabel ? `${name} [${unitLabel}]` : name;
}

// Resolves unit abbreviations for products so UI names can show them without changing stored names.
async function unitLabelMap(products) {
  const ids = [...new Set(products.map((product) => product.unitId?.toString()).filter(Boolean))];
  const labels = new Map();
  labels.names = new Map();
  if (!ids.length) return labels;
  const units = await Unit.find({ _id: { $in: ids } }).select('name abbreviation').lean();
  units.forEach((unit) => {
    labels.set(unit._id.toString(), unit.abbreviation || unit.name);
    labels.names.set(unit._id.toString(), unit.name);
  });
  return labels;
}

// packageUnitName is the full base unit name (Dozen, Box, Bag...) used for the primary pack unit in POS and stock count.
function displayFields(product, labels) {
  const key = product.unitId?.toString();
  const unitLabel = labels.get(key) || null;
  return {
    unitLabel,
    packageUnitName: labels.names?.get(key) || null,
    displayName: formatDisplayName(product.name, unitLabel),
  };
}

module.exports = { formatDisplayName, unitLabelMap, displayFields };
