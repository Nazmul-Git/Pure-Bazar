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

// Totals are summed per pack ratio (Box/Dozen/etc.) and each group is shown in the same human-readable format as the products table.
export const totalStock = (value, products = [], field) => {
  if (!field || products.length === 0) return qty(value);
  const groups = new Map();
  products.forEach((p) => {
    const key = `${p.unitsPerPackage || 1}|${p.packageUnitName || ''}`;
    const group = groups.get(key) || { product: p, total: 0 };
    group.total += Number(p[field]) || 0;
    groups.set(key, group);
  });
  return [...groups.values()]
    .map(({ product, total }) => stockText(Math.round(total * 1e6) / 1e6, product))
    .join(' + ');
};

export const formatDate = (value) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : new Intl.DateTimeFormat('en-BD', { dateStyle: 'medium' }).format(parsed);
};
