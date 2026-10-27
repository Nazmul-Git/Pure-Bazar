const DOZEN_KEYS = ['doz', 'dozen', 'dzn'];

// Convenience default only; the user can always change it.
function defaultPiecesPerPackage(unit) {
  if (!unit) return '';
  const keys = [unit.name, unit.abbreviation].map((v) => String(v || '').trim().toLowerCase().replace(/\.$/, ''));
  return keys.some((key) => DOZEN_KEYS.includes(key)) ? '12' : '';
}

// Total system pieces = unit quantity * pieces per package. Returns '' when not a valid whole number.
function totalPieces(quantity, piecesPerPackage) {
  const qty = Number(quantity);
  const per = Number(piecesPerPackage);
  if (quantity === '' || piecesPerPackage === '' || !Number.isFinite(qty) || !Number.isFinite(per) || qty <= 0 || per <= 0) return '';
  const pieces = Math.round(qty * per * 1e6) / 1e6;
  return Number.isInteger(pieces) && pieces > 1 ? String(pieces) : '';
}

// Exact (unrounded) cost of one piece.
function basePieceCost(mrp, total) {
  const price = Number(mrp);
  const pieces = Number(total);
  if (!Number.isFinite(price) || !Number.isFinite(pieces) || pieces <= 0) return null;
  return price / pieces;
}

module.exports = { defaultPiecesPerPackage, totalPieces, basePieceCost };
