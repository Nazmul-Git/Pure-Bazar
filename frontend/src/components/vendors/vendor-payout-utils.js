function localDateInput(value = new Date()) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 10);
}

function formatMoney(amount) {
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

function formatDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '—'
    : new Intl.DateTimeFormat('en-BD', { dateStyle: 'medium' }).format(parsed);
}

function idString(value) {
  return (typeof value === 'string' ? value : value?._id?.toString()) || '';
}

function makePaymentPayload(payment) {
  return {
    status: 'Paid',
    paymentMethod: payment.paymentMethod,
    paymentReference: payment.paymentReference.trim(),
    paidAt: payment.paidAt,
    receiverName: payment.receiverName.trim(),
  };
}

function filterPayoutRows(rows, status, vendorId) {
  return rows.filter((row) => (
    (!status || row.status === status)
    && (!vendorId || row.vendor.id === vendorId)
  ));
}

module.exports = {
  filterPayoutRows,
  formatDate,
  formatMoney,
  idString,
  localDateInput,
  makePaymentPayload,
};
