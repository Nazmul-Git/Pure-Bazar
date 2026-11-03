export const money = (amount) => new Intl.NumberFormat('en-BD', {
  style: 'currency',
  currency: 'BDT',
  minimumFractionDigits: 2,
}).format(Math.round(((Number(amount) || 0) + Number.EPSILON) * 100) / 100);

export const qty = (value) => new Intl.NumberFormat('en-BD', {
  maximumFractionDigits: 3,
}).format(Math.round(((Number(value) || 0) + Number.EPSILON) * 1000) / 1000);

export const formatDate = (value) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : new Intl.DateTimeFormat('en-BD', { dateStyle: 'medium' }).format(parsed);
};
