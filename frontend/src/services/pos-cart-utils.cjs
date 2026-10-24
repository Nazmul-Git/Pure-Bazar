const STOCK_LIMIT_MESSAGE = 'Stock limit reached for this product';

// Returns a whole-number quantity between 1 and the available stock.
function clampQuantity(value, stock) {
  const parsed = Math.floor(Number(value));
  const whole = Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
  const limit = Math.floor(Number(stock));
  if (Number.isFinite(limit) && whole > limit) return { quantity: Math.max(limit, 0), limited: true };
  return { quantity: whole, limited: false };
}

function hasStockProblem(items) {
  return items.some((item) => Number(item.stock) < 1 || Number(item.quantity) > Number(item.stock));
}

module.exports = { STOCK_LIMIT_MESSAGE, clampQuantity, hasStockProblem };
