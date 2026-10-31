const { canSellPieces, unitPrice } = require('./pos-cart-utils.cjs');

// Selectable units for a label, priced with the same rules as POS billing:
// base unit = mrp / unitValue, piece = subUnitPrice.
function getUnitOptions(product) {
  const baseName = product?.packageUnitName || product?.unitLabel || 'Unit';
  const options = [{ value: 'base', name: baseName, price: unitPrice({ ...product, unit: 'BASE' }) }];
  if (canSellPieces(product || {})) {
    options.push({ value: 'piece', name: 'Pcs', price: unitPrice({ ...product, unit: 'PIECE' }) });
  }
  return options;
}

module.exports = { getUnitOptions };
