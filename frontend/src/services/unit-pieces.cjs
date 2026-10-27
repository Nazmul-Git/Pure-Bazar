const FIXED_RATIOS = {
  doz: 12, dozen: 12, dzn: 12, pair: 2, prs: 2, gross: 144,
};

function unitRatio(unit) {
  if (!unit) return null;
  const keys = [unit.name, unit.abbreviation].map((v) => String(v || '').trim().toLowerCase().replace(/\.$/, ''));
  const hit = keys.find((key) => FIXED_RATIOS[key]);
  return hit ? FIXED_RATIOS[hit] : null;
}

function totalPieces(unit, quantity) {
  const ratio = unitRatio(unit);
  const value = Number(quantity);
  if (!ratio || quantity === '' || !Number.isFinite(value) || value <= 0) return '';
  const pieces = Math.round(value * ratio * 1e6) / 1e6;
  return Number.isInteger(pieces) && pieces > 1 ? String(pieces) : '';
}

module.exports = { unitRatio, totalPieces };
