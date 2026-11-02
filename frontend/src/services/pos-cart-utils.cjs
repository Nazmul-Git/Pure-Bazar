const STOCK_LIMIT_MESSAGE = 'Stock limit reached for this product';

// Returns a whole-number quantity between 1 and the available stock.
function clampQuantity(value, stock) {
  const parsed = Math.floor(Number(value));
  const whole = Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
  const limit = Math.floor(Number(stock));
  if (Number.isFinite(limit) && whole > limit) return { quantity: Math.max(limit, 0), limited: true };
  return { quantity: whole, limited: false };
}

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

function canSellPieces(item) {
  return Number(item.unitsPerPackage) > 1 && Number.isFinite(Number(item.subUnitPrice));
}

function isPiece(item) {
  return item.unit === 'PIECE' && canSellPieces(item);
}

// Stock expressed in the unit currently selected for the cart line.
// Stock is stored in packages; convert once to base pieces, then derive Box/Pcs from that single figure.
function totalPieces(item) {
  return Math.round((Number(item.stock) || 0) * Number(item.unitsPerPackage));
}

function availableStock(item) {
  if (!canSellPieces(item)) return Math.floor(Number(item.stock) || 0);
  const pieces = totalPieces(item);
  return isPiece(item) ? pieces : Math.floor(pieces / Number(item.unitsPerPackage));
}

function unitPrice(item) {
  if (isPiece(item)) return Number(item.subUnitPrice);
  const quantity = Number(item.unitValue);
  const divisor = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  return round2(Number(item.mrp) / divisor);
}

function lineTotal(item) {
  return round2(unitPrice(item) * Number(item.quantity || 0));
}

function hasStockProblem(items) {
  return items.some((item) => availableStock(item) < 1 || Number(item.quantity) > availableStock(item));
}

module.exports = {
  STOCK_LIMIT_MESSAGE, availableStock, canSellPieces, clampQuantity, hasStockProblem, isPiece, lineTotal, unitPrice,
};
