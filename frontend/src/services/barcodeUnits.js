const { canSellPieces, unitPrice } = require('./pos-cart-utils.cjs');
const { isGram } = require('./stock-units.cjs');
// Selectable units for a label, priced with the same rules as POS billing:
// base unit = mrp / unitValue, piece = subUnitPrice.
function getUnitOptions(product) {
  const baseName = product?.packageUnitName || product?.unitLabel || 'Unit';
  if (isGram(baseName) && !canSellPieces(product || {})) {
    const perGram = unitPrice({ ...product, unit: 'BASE' });
    return [
      { value: 'kg', name: 'Kg', price: Math.round((perGram * 1000 + Number.EPSILON) * 100) / 100 },
      { value: 'gram', name: 'Gram', price: perGram },
    ];
  }
  const options = [{ value: 'base', name: baseName, price: unitPrice({ ...product, unit: 'BASE' }) }];
  if (canSellPieces(product || {})) {
    options.push({ value: 'piece', name: 'Pcs', price: unitPrice({ ...product, unit: 'PIECE' }) });
  }
  return options;
}

module.exports = { getUnitOptions };
