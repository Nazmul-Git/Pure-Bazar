const roundMoney = (amount) => Math.round((amount + Number.EPSILON) * 100) / 100;
const toCents = (amount) => Math.round(roundMoney(amount) * 100);
const fromCents = (amount) => amount / 100;

function requireNumber(value, name, { min = 0, max = Infinity } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new TypeError(`${name} must be a number from ${min} to ${max}`);
  }
  return value;
}

function discountCents(discount, baseCents, name) {
  if (discount == null) return 0;
  if (!discount || !['PERCENT', 'FIXED'].includes(discount.type)) {
    throw new TypeError(`${name} type must be PERCENT or FIXED`);
  }
  const value = requireNumber(discount.value, `${name} value`, {
    max: discount.type === 'PERCENT' ? 100 : Infinity,
  });
  if (value > 0 && (typeof discount.reason !== 'string' || !discount.reason.trim())) {
    throw new TypeError(`${name} reason is required`);
  }
  if (value > 0 && /\bshareholder\b/i.test(discount.reason)) {
    throw new TypeError(`${name} reason cannot refer to a shareholder discount; it is applied automatically`);
  }
  const amount = discount.type === 'PERCENT'
    ? Math.round(baseCents * value / 100)
    : toCents(value);
  return Math.min(baseCents, amount);
}

function allocateCents(amountCents, weights) {
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  if (!amountCents || !weightTotal) return weights.map(() => 0);
  let remaining = amountCents;
  return weights.map((weight, index) => {
    const allocation = index === weights.length - 1
      ? remaining
      : Math.min(remaining, Math.round(amountCents * weight / weightTotal));
    remaining -= allocation;
    return allocation;
  });
}

function calculateBill({ items, paymentMethod, shareholder, billDiscount, settings = {} }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new TypeError('items must be a non-empty array');
  }
  if (!['WALLET', 'CASH', 'BKASH', 'NAGAD', 'CARD'].includes(paymentMethod)) {
    throw new TypeError('paymentMethod is not supported');
  }
  const vatOrder = settings.vatCalculationOrder || 'DISCOUNT_THEN_VAT';
  if (!['DISCOUNT_THEN_VAT', 'VAT_THEN_DISCOUNT'].includes(vatOrder)) {
    throw new TypeError('vatCalculationOrder is not supported');
  }
  const vatEnabled = settings.vatEnabled === true;
  const defaultVatRate = requireNumber(settings.defaultVatRate ?? 0, 'defaultVatRate', { max: 100 });
  const shareholderPercent = requireNumber(settings.shareholderDiscountPercent ?? 5, 'shareholderDiscountPercent', { max: 100 });

  const lines = items.map((item, index) => {
    if (!item || !['COMPANY', 'VENDOR'].includes(item.ownerType)) {
      throw new TypeError(`items[${index}].ownerType must be COMPANY or VENDOR`);
    }
    const quantity = requireNumber(item.quantity, `items[${index}].quantity`, { min: Number.EPSILON });
    const mrp = requireNumber(item.mrp, `items[${index}].mrp`);
    const vendorPrice = requireNumber(item.vendorPrice, `items[${index}].vendorPrice`);
    const subtotalCents = toCents(mrp * quantity);
    const itemDiscountCents = discountCents(item.discount, subtotalCents, `items[${index}].discount`);
    const categoryVatRate = item.categoryVatRate ?? item.category?.vatRate;
    const vatRate = item.vatRate ?? categoryVatRate ?? defaultVatRate;
    requireNumber(vatRate, `items[${index}].vatRate`, { max: 100 });
    return {
      productId: item.productId,
      vendorId: item.vendorId,
      ownerType: item.ownerType,
      quantity,
      subtotalCents,
      itemDiscountCents,
      remainingCents: subtotalCents - itemDiscountCents,
      vendorPayableCents: item.ownerType === 'VENDOR' ? toCents(vendorPrice * quantity) : 0,
      vatRate: vatEnabled && item.vatApplicable === true ? vatRate : 0,
    };
  });

  const subtotalCents = lines.reduce((sum, line) => sum + line.subtotalCents, 0);
  const afterItemDiscountCents = lines.reduce((sum, line) => sum + line.remainingCents, 0);
  const billDiscountCents = discountCents(billDiscount, afterItemDiscountCents, 'billDiscount');
  const billAllocations = allocateCents(billDiscountCents, lines.map((line) => line.remainingCents));
  lines.forEach((line, index) => {
    line.billDiscountCents = billAllocations[index];
    line.afterOtherDiscountCents = line.remainingCents - line.billDiscountCents;
  });

  const otherDiscountCents = lines.reduce(
    (sum, line) => sum + line.itemDiscountCents + line.billDiscountCents,
    0,
  );
  const shareholderEligible = paymentMethod === 'WALLET' && shareholder?.verified === true;
  const afterOtherDiscountCents = lines.reduce((sum, line) => sum + line.afterOtherDiscountCents, 0);
  const shareholderDiscountCents = shareholderEligible
    ? Math.round(afterOtherDiscountCents * shareholderPercent / 100)
    : 0;
  const shareholderAllocations = allocateCents(
    shareholderDiscountCents,
    lines.map((line) => line.afterOtherDiscountCents),
  );

  let vatTotalCents = 0;
  const ledgerLines = lines.map((line, index) => {
    const vatBaseCents = vatOrder === 'VAT_THEN_DISCOUNT'
      ? line.remainingCents
      : line.afterOtherDiscountCents - shareholderAllocations[index];
    const vatCents = Math.round(vatBaseCents * line.vatRate / 100);
    vatTotalCents += vatCents;
    const lineDiscountCents = line.itemDiscountCents
      + line.billDiscountCents
      + shareholderAllocations[index];
    const companyNetCents = (line.subtotalCents - line.vendorPayableCents) - lineDiscountCents;
    return {
      productId: line.productId,
      vendorId: line.vendorId,
      ownerType: line.ownerType,
      quantity: line.quantity,
      subtotal: fromCents(line.subtotalCents),
      itemDiscountAmount: fromCents(line.itemDiscountCents),
      billDiscountAmount: fromCents(line.billDiscountCents),
      shareholderDiscountAmount: fromCents(shareholderAllocations[index]),
      discountAmount: fromCents(lineDiscountCents),
      vatRate: line.vatRate,
      vatAmount: fromCents(vatCents),
      vendorPayable: fromCents(line.vendorPayableCents),
      companyNet: fromCents(companyNetCents),
    };
  });

  const grandTotalCents = subtotalCents - otherDiscountCents
    - shareholderDiscountCents + vatTotalCents;
  return {
    subtotal: fromCents(subtotalCents),
    otherDiscountAmount: fromCents(otherDiscountCents),
    shareholderDiscountAmount: fromCents(shareholderDiscountCents),
    vatAmount: fromCents(vatTotalCents),
    grandTotal: fromCents(grandTotalCents),
    ledgerLines,
  };
}

module.exports = { calculateBill };
