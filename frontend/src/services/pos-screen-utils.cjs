const paymentLabels = {
  CASH: 'Cash',
  BKASH: 'bKash',
  NAGAD: 'Nagad',
  CARD: 'Card',
  WALLET: 'Wallet',
  BANK: 'Bank',
};

function buildSalesHistoryParams(filters = {}) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
}

function isWalletSale(order) {
  return Boolean(order?.payments?.some((payment) => payment.method === 'WALLET'));
}

function paymentMethodLabel(method) {
  return paymentLabels[method] || method || '—';
}

function sumMoney(values) {
  const cents = values.reduce((total, value) => (
    total + Math.round(((Number(value) || 0) + Number.EPSILON) * 100)
  ), 0);
  return cents / 100;
}

module.exports = {
  buildSalesHistoryParams,
  isWalletSale,
  paymentMethodLabel,
  sumMoney,
};
