const { Order, Product, StockMovement } = require('../models');
const {
  money, sumCents, milli, qty, periodBounds, inPeriod, bucketKey, soldAt, byKey,
} = require('./reportUtils');

const DEFAULT_LOW_STOCK_THRESHOLD = 10;

async function salesReport({ from, to, groupBy = 'day' } = {}) {
  const bounds = periodBounds({ from, to });
  const orders = (await Order.find({ paymentStatus: 'PAID' }).lean())
    .filter((order) => inPeriod(soldAt(order), bounds));
  const buckets = new Map();
  orders.forEach((order) => {
    const key = bucketKey(soldAt(order), groupBy);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(order);
  });
  const summarize = (list) => ({
    billCount: list.length,
    subtotal: money(sumCents(list, (o) => o.subtotal)),
    discounts: money(sumCents(list, (o) => Number(o.otherDiscountAmount || 0) + Number(o.shareholderDiscountAmount || 0))),
    vat: money(sumCents(list, (o) => o.vatAmount)),
    totalSales: money(sumCents(list, (o) => o.grandTotal)),
  });
  const rows = [...buckets.entries()].map(([period, list]) => ({ period, ...summarize(list) })).sort(byKey);
  return { groupBy, from: from || null, to: to || null, rows, totals: summarize(orders) };
}

async function stockReport({ from, to, lowStockThreshold = DEFAULT_LOW_STOCK_THRESHOLD } = {}) {
  const bounds = periodBounds({ from, to });
  const [movements, products] = await Promise.all([
    StockMovement.find({}).lean(),
    Product.find({}).select('name barcode').lean(),
  ]);
  const stats = new Map(products.map((product) => [String(product._id), {
    productId: String(product._id),
    productName: product.name,
    barcode: product.barcode,
    opening: 0, received: 0, soldNet: 0, otherChange: 0, closing: 0, onHand: 0,
  }]));

  movements.forEach((movement) => {
    const row = stats.get(String(movement.productId));
    if (!row) return;
    const amount = milli(movement.quantity);
    const time = new Date(movement.createdAt).getTime();
    row.onHand += amount;
    if (bounds.start && time < bounds.start.getTime()) {
      row.opening += amount;
      row.closing += amount;
      return;
    }
    if (bounds.end && time >= bounds.end.getTime()) return;
    row.closing += amount;
    if (movement.type === 'SALE' || movement.type === 'RETURN') row.soldNet -= amount;
    else if (movement.type === 'GRN') row.received += amount;
    else row.otherChange += amount;
  });

  // Turnover = units sold (net of returns) / average of opening and closing stock.
  const rows = [...stats.values()].map((row) => {
    const average = (row.opening + row.closing) / 2;
    return {
      productId: row.productId,
      productName: row.productName,
      barcode: row.barcode,
      opening: qty(row.opening),
      received: qty(row.received),
      sold: qty(row.soldNet),
      otherChange: qty(row.otherChange),
      closing: qty(row.closing),
      onHand: qty(row.onHand),
      turnover: average > 0 ? Math.round((row.soldNet / average) * 10000) / 10000 : null,
    };
  }).filter((row) => row.opening || row.received || row.sold || row.otherChange || row.closing || row.onHand)
    .sort((a, b) => a.productName.localeCompare(b.productName));

  const lowStock = rows.filter((row) => row.onHand <= lowStockThreshold)
    .map(({ productId, productName, barcode, onHand }) => ({ productId, productName, barcode, quantity: onHand }))
    .sort((a, b) => a.quantity - b.quantity || a.productName.localeCompare(b.productName));
  return { from: from || null, to: to || null, lowStockThreshold, rows, lowStock };
}

module.exports = { salesReport, stockReport, DEFAULT_LOW_STOCK_THRESHOLD };
