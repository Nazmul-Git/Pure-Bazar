// Prices are handled in integer cents so ceiling never suffers float drift.
function toCents(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100);
}

function roundUpToCent(value) {
  const cents = Number(value) * 100;
  // Subtract a tiny tolerance so exact results such as 12.5 * 100 do not round up.
  return Math.ceil(cents - 1e-9) / 100;
}

function calculateSubUnitPrice(packagePrice, unitsPerPackage) {
  const units = Number(unitsPerPackage);
  if (!Number.isInteger(units) || units < 1) return null;
  return roundUpToCent(toCents(packagePrice) / units / 100);
}

// Manager override wins; otherwise the margin-safe rounded-up price is used.
function effectiveSubUnitPrice(product) {
  if (!product || !(product.unitsPerPackage > 1)) return null;
  if (Number.isFinite(product.subUnitPriceOverride)) {
    return Math.round((product.subUnitPriceOverride + Number.EPSILON) * 100) / 100;
  }
  return calculateSubUnitPrice(product.mrp, product.unitsPerPackage);
}

function packageUnitPrice(product) {
  const quantity = Number(product.unitValue);
  const divisor = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  return Math.round((product.mrp / divisor + Number.EPSILON) * 100) / 100;
}

// Resolves the unit price and stock deduction (in packages) for a cart line.
function linePricing(product, item) {
  if (item.unit !== 'PIECE') {
    const quantity = Number(product.unitValue);
    const divisor = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
    return {
      unitPrice: packageUnitPrice(product),
      unitVendorPrice: Math.round((product.vendorPrice / divisor + Number.EPSILON) * 100) / 100,
      stockQuantity: item.quantity,
    };
  }
  const price = effectiveSubUnitPrice(product);
  if (price === null) return null;
  return {
    unitPrice: price,
    unitVendorPrice: product.vendorPrice / product.unitsPerPackage,
    stockQuantity: item.quantity / product.unitsPerPackage,
  };
}

module.exports = {
  calculateSubUnitPrice, effectiveSubUnitPrice, packageUnitPrice, roundUpToCent, linePricing,
};
