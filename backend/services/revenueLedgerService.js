const {
  Category, Order, Product, VendorLedger,
} = require('../models');
const { periodBounds } = require('./vendorSettlementService');

const cents = (value) => Math.round((Number(value) + Number.EPSILON) * 100);

function newRow(categoryId, name) {
  return {
    categoryId, category: name, salesCents: 0, discountsCents: 0, vatCents: 0, incomeCents: 0, returnsCents: 0,
  };
}

function format(row) {
  return {
    categoryId: row.categoryId,
    category: row.category,
    sales: row.salesCents / 100,
    discounts: row.discountsCents / 100,
    income: row.incomeCents / 100,
    returnsAdjustment: row.returnsCents / 100,
    vat: row.vatCents / 100,
  };
}

// Income is the company margin (MRP - vendor price) minus discounts, already
// stored on the vendor ledger as companyNet. VAT is collected tax and is
// reported in its own column, never added to income.
async function getRevenueLedger(startDate, endDate) {
  const { start, endExclusive } = periodBounds(startDate, endDate);
  const entries = await VendorLedger.find({ createdAt: { $gte: start, $lt: endExclusive } }).lean();
  const orderIds = [...new Set(entries.map((entry) => String(entry.orderId)))];
  const productIds = [...new Set(entries.map((entry) => String(entry.productId)))];
  const [orders, products] = await Promise.all([
    orderIds.length ? Order.find({ _id: { $in: orderIds } }).lean() : [],
    productIds.length ? Product.find({ _id: { $in: productIds } }).select('categoryId').lean() : [],
  ]);
  const categoryByProduct = new Map(products.map((product) => [String(product._id), String(product.categoryId)]));
  const categoryIds = [...new Set(categoryByProduct.values())];
  const categories = categoryIds.length
    ? await Category.find({ _id: { $in: categoryIds } }).select('name').lean() : [];
  const nameById = new Map(categories.map((category) => [String(category._id), category.name]));
  const orderById = new Map(orders.map((order) => [String(order._id), order]));

  const rows = new Map();
  const rowFor = (productId) => {
    const categoryId = categoryByProduct.get(String(productId)) || 'uncategorized';
    if (!rows.has(categoryId)) rows.set(categoryId, newRow(categoryId, nameById.get(categoryId) || 'Uncategorized'));
    return rows.get(categoryId);
  };

  const countedLines = new Set();
  entries.forEach((entry) => {
    const row = rowFor(entry.productId);
    row.incomeCents += cents(entry.companyNet);
    if (entry.entryType === 'RETURN') {
      row.returnsCents += cents(entry.companyNet);
      return;
    }
    const key = `${entry.orderId}|${entry.productId}`;
    if (countedLines.has(key)) return;
    countedLines.add(key);
    (orderById.get(String(entry.orderId))?.lines || [])
      .filter((line) => String(line.productId) === String(entry.productId))
      .forEach((line) => {
        row.salesCents += cents(line.subtotal);
        row.discountsCents += cents(line.itemDiscountAmount) + cents(line.billDiscountAmount)
          + cents(line.shareholderDiscountAmount);
        row.vatCents += cents(line.vatAmount);
      });
  });

  const list = [...rows.values()].sort((a, b) => a.category.localeCompare(b.category));
  const total = list.reduce((sum, row) => ({
    salesCents: sum.salesCents + row.salesCents,
    discountsCents: sum.discountsCents + row.discountsCents,
    vatCents: sum.vatCents + row.vatCents,
    incomeCents: sum.incomeCents + row.incomeCents,
    returnsCents: sum.returnsCents + row.returnsCents,
  }), newRow(null, 'Total'));
  const { categoryId, category, ...totals } = format(total);
  return { categories: list.map(format), totals };
}

module.exports = { getRevenueLedger };
