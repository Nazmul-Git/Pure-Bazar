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

function formatStock(quantity, unitsPerPackage) {
  const value = Number(quantity) || 0;
  if (!isMultiUnit(unitsPerPackage)) return String(Math.round(value * 1e6) / 1e6);
  const { boxes, pieces } = splitQuantity(value, unitsPerPackage);
  if (!pieces) return `${boxes} Box(es)`;
  if (!boxes) return `${pieces} Pcs`;
  return `${boxes} Box(es) and ${pieces} Pcs`;
}

module.exports = { isMultiUnit, splitQuantity, combineQuantity, formatStock };
