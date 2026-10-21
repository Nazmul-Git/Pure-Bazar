export function localDateInput(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function firstDayOfMonth(date = new Date()) {
  return `${localDateInput(date).slice(0, 7)}-01`;
}

export function formatFinanceMoney(value) {
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 2,
  }).format(Number(value) || 0);
}

export function formatFinanceDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('en-BD', { dateStyle: 'medium' }).format(date);
}

export function sumMoneyCents(rows, field) {
  return rows.reduce((sum, row) => {
    const amount = Number(row[field]);
    return sum + Math.round(((Number.isFinite(amount) ? amount : 0) + Number.EPSILON) * 100);
  }, 0);
}
