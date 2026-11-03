import { stockText } from '@/services/stock-units.cjs';

export const money = (amount) => new Intl.NumberFormat('en-BD', {
  style: 'currency',
  currency: 'BDT',
  minimumFractionDigits: 2,
}).format(Math.round(((Number(amount) || 0) + Number.EPSILON) * 100) / 100);

export const qty = (value) => new Intl.NumberFormat('en-BD', {
  maximumFractionDigits: 3,
}).format(Math.round(((Number(value) || 0) + Number.EPSILON) * 1000) / 1000);

// Per-product stock as Box/Dozen and Pcs, same helper as POS and Stock Count.
export const productStock = (value, product) => stockText(value, product);

// Totals mix products with different pack sizes, so they are formatted only when every product shares one pack ratio.
export const totalStock = (value, products = []) => {
  const [first] = products;
  const same = first && products.every((p) => (p.unitsPerPackage || 1) === (first.unitsPerPackage || 1)
    && (p.packageUnitName || '') === (first.packageUnitName || ''));
  return same ? stockText(value, first) : qty(value);
};

export const formatDate = (value) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : new Intl.DateTimeFormat('en-BD', { dateStyle: 'medium' }).format(parsed);
};
