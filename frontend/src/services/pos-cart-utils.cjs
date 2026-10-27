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
function availableStock(item) {
  const packages = Number(item.stock) || 0;
  return isPiece(item) ? Math.floor(Math.round(packages * item.unitsPerPackage * 1e6) / 1e6) : Math.floor(packages);
}

function unitPrice(item) {
  return isPiece(item) ? Number(item.subUnitPrice) : Number(item.mrp);
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
