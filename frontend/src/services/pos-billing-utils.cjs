function discountPayload(discount, label) {
  if (!discount || discount.value === '' || discount.value == null || Number(discount.value) === 0) return null;
  const value = Number(discount.value);
  if (!Number.isFinite(value) || value < 0 || (discount.type === 'PERCENT' && value > 100)) {
    throw new Error(`${label} must be a valid amount${discount.type === 'PERCENT' ? ' up to 100%' : ''}.`);
  }
  if (!discount.reason?.trim()) throw new Error(`A reason is required for the ${label.toLowerCase()}.`);
  if (/\bshareholder\b/i.test(discount.reason)) {
    throw new Error('Shareholder discounts are automatic and cannot be entered as manual discounts.');
  }
  return { type: discount.type, value, reason: discount.reason.trim() };
}

function requestItems(items) {
  return items.map((item) => {
    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`Enter a valid quantity for ${item.name}.`);
    }
    const discount = discountPayload(item.discount, `Discount for ${item.name}`);
    return {
      productId: item.productId,
      quantity,
      ...(discount ? { discount } : {}),
    };
  });
}

function createPreviewPayload(items, billDiscount, methods, shareholder) {
  if (!methods.length || new Set(methods).size !== methods.length) {
    throw new Error('Select one or more different payment methods.');
  }
  if (methods.includes('WALLET') && methods.length !== 1) {
    throw new Error('Wallet cannot be split with another payment method.');
  }
  const discount = billDiscount ? discountPayload(billDiscount, 'Bill discount') : null;
  return {
    items: requestItems(items),
    payments: methods.map((method) => ({ method })),
    ...(discount ? { billDiscount: discount } : {}),
    ...(shareholder ? { shareholderId: shareholder._id } : {}),
  };
}

function paymentTotalMatches(methods, amounts, total) {
  if (!methods.length) return false;
  if (methods.includes('WALLET')) return methods.length === 1 && Number(total) > 0;
  if (methods.some((method) => !Number.isFinite(Number(amounts[method])) || Number(amounts[method]) <= 0)) {
    return false;
  }
  const paid = methods.reduce((sum, method) => (
    sum + Number(amounts[method])
  ), 0);
  return Math.round((paid + Number.EPSILON) * 100) === Math.round((Number(total) + Number.EPSILON) * 100);
}

module.exports = {
  createPreviewPayload,
  discountPayload,
  paymentTotalMatches,
  requestItems,
};
