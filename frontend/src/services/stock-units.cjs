const isMultiUnit = (unitsPerPackage) => Number.isInteger(Number(unitsPerPackage)) && Number(unitsPerPackage) > 1;

// Splits a package quantity (possibly fractional) into whole packages and loose pieces.
function splitQuantity(quantity, unitsPerPackage) {
  const value = Number(quantity) || 0;
  if (!isMultiUnit(unitsPerPackage)) return { boxes: value, pieces: 0 };
  const sign = value < 0 ? -1 : 1;
  const totalPieces = Math.round(Math.abs(value) * Number(unitsPerPackage));
  return {
    boxes: sign * Math.floor(totalPieces / unitsPerPackage),
    pieces: sign * (totalPieces % unitsPerPackage),
  };
}

// Converts boxes + loose pieces back to the stored package quantity.
function combineQuantity(boxes, pieces, unitsPerPackage) {
  const b = Number(boxes) || 0;
  const p = Number(pieces) || 0;
  if (!isMultiUnit(unitsPerPackage)) return b;
  return Math.round((b * Number(unitsPerPackage) + p)) / Number(unitsPerPackage);
}

const isGram = (unit) => /^(gram|grams|g)$/i.test(String(unit || '').trim());

// Display only: quantities stay in grams everywhere else.
function formatStockDisplay(quantity, unit) {
  const value = Number(quantity) || 0;
  if (!isGram(unit)) return String(Math.round(value * 1e6) / 1e6);
  const sign = value < 0 ? '-' : '';
  const grams = Math.round(Math.abs(value));
  const kg = Math.floor(grams / 1000);
  const rest = grams % 1000;
  if (!kg) return `${sign}${rest} Gram`;
  return rest ? `${sign}${kg} Kg ${rest} Gram` : `${sign}${kg} Kg`;
}

// Converts what the cashier typed (in Kg or Gram) to whole grams.
function toGrams(value, unit) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.round(number * (String(unit).toLowerCase() === 'kg' ? 1000 : 1));
}

// Converts grams to the number shown in the selected input unit.
function fromGrams(grams, unit) {
  const value = Number(grams) || 0;
  return String(unit).toLowerCase() === 'kg' ? Math.round(value) / 1000 : Math.round(value);
}

function formatStock(quantity, unitsPerPackage, packageUnitName) {
  const value = Number(quantity) || 0;
  if (!isMultiUnit(unitsPerPackage) && isGram(packageUnitName)) return formatStockDisplay(value, packageUnitName);
  if (!isMultiUnit(unitsPerPackage)) return String(Math.round(value * 1e6) / 1e6);
  const name = packageUnitName || 'Box';
  const { boxes, pieces } = splitQuantity(value, unitsPerPackage);
  if (!pieces) return `${boxes} ${packageUnitName ? name : 'Box(es)'}`;
  if (!boxes) return `${pieces} Pcs`;
  return `${boxes} ${packageUnitName ? name : 'Box(es)'} and ${pieces} Pcs`;
}

function formatLineQuantity(line) {
  const value = Number(line?.quantity) || 0;
  if (line?.unit === 'PIECE') return `${value} Pcs`;
  const name = line?.packageUnitName;
  if (isGram(name)) return formatStockDisplay(value, name);
  return `${Math.round(value * 1e6) / 1e6} ${name || 'Box'}`;
}

module.exports = { isMultiUnit, splitQuantity, combineQuantity, formatStock, formatStockDisplay, formatLineQuantity, isGram, toGrams, fromGrams };
