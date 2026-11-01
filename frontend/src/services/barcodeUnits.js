const { canSellPieces, unitPrice } = require('./pos-cart-utils.cjs');
const { isGram } = require('./stock-units.cjs');
const UNIVERSAL_UNITS = ['Box', 'Pcs', 'Pack', 'Packet', 'Kg', 'Gram', 'Liter', 'ML', 'Dozen', 'Bag', 'Bottle', 'Carton', 'Pair', 'Set', 'Meter'];

// Product units come first with POS-derived default prices (base = mrp / unitValue,
// piece = subUnitPrice); every other universal unit is appended with no price scaling.
function getUnitOptions(product) {
  const own = getProductUnitOptions(product);
  const taken = new Set(own.map((option) => option.name.toLowerCase()));
  const fallback = Number(product?.mrp) || 0;
  const extras = UNIVERSAL_UNITS.filter((name) => !taken.has(name.toLowerCase()))
    .map((name) => ({ value: name.toLowerCase(), name, price: fallback }));
  return [...own, ...extras];
}

function getProductUnitOptions(product) {
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

module.exports = { UNIVERSAL_UNITS, getUnitOptions };
