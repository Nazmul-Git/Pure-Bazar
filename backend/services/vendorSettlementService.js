const { Product, StockMovement, VendorLedger } = require('../models');

function cents(value) {
  return Math.round((value + Number.EPSILON) * 100);
}

function money(value) {
  return cents(value) / 100;
}

function periodBounds(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const endExclusive = new Date(`${endDate}T00:00:00.000Z`);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  return { start, endExclusive, end: new Date(endExclusive.getTime() - 1) };
}

async function getPeriodLedger(vendorId, start, endExclusive, entryTypes) {
  return VendorLedger.find({
    vendorId,
    ...(entryTypes ? { entryType: { $in: entryTypes } } : {}),
    createdAt: { $gte: start, $lt: endExclusive },
  }).sort({ createdAt: 1, _id: 1 }).lean();
}

function qty(value) {
  return Math.round(((Number(value) || 0) + Number.EPSILON) * 1000) / 1000;
}

async function getStockSnapshot(vendorId, start, endExclusive) {
  const products = await Product.find({ ownerType: 'VENDOR', vendorId })
    .select('_id name barcode vendorPrice mrp')
    .sort({ name: 1 })
    .lean();
  const productIds = products.map((product) => product._id);
  if (!productIds.length) {
    return { openingStock: 0, receipts: 0, closingStock: 0, products: [] };
  }

  const rows = await StockMovement.aggregate([
    {
      $match: {
        productId: { $in: productIds },
        createdAt: { $lt: endExclusive },
      },
    },
    {
      $group: {
        _id: '$productId',
        openingStock: {
          $sum: { $cond: [{ $lt: ['$createdAt', start] }, '$quantity', 0] },
        },
        receipts: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$type', 'GRN'] },
                  { $gte: ['$createdAt', start] },
                ],
              },
              '$quantity',
              0,
            ],
          },
        },
        closingStock: { $sum: '$quantity' },
      },
    },
  ]);
  const byProduct = new Map(rows.map((row) => [row._id.toString(), row]));
  const lines = products.map((product) => {
    const row = byProduct.get(product._id.toString()) || {};
    return {
      productId: product._id,
      name: product.name,
      barcode: product.barcode,
      vendorPrice: product.vendorPrice,
      mrp: product.mrp,
      openingStock: qty(row.openingStock),
      receipts: qty(row.receipts),
      closingStock: qty(row.closingStock),
    };
  });
  const sum = (field) => qty(lines.reduce((total, line) => total + line[field], 0));
  return {
    openingStock: sum('openingStock'),
    receipts: sum('receipts'),
    closingStock: sum('closingStock'),
    products: lines,
  };
}

function productBreakdown(stockLines, entries) {
  const activity = new Map();
  entries.forEach((entry) => {
    const key = entry.productId.toString();
    const current = activity.get(key) || { sales: 0, returns: 0, salesCents: 0, returnCents: 0 };
    if (entry.entryType === 'SALE') {
      current.sales += entry.quantity;
      current.salesCents += cents(entry.vendorPayable);
    } else {
      current.returns += entry.quantity;
      current.returnCents += cents(entry.vendorPayable);
    }
    activity.set(key, current);
  });
  return stockLines.map((line) => {
    const item = activity.get(line.productId.toString()) || { sales: 0, returns: 0, salesCents: 0, returnCents: 0 };
    return {
      ...line,
      sales: qty(item.sales),
      returns: qty(item.returns),
      salesValueAtVendorPrice: item.salesCents / 100,
      closingStockValue: money(line.closingStock * line.vendorPrice),
    };
  });
}

async function getLedger(vendorId, start, endExclusive) {
  const [entries, stock, allEntries] = await Promise.all([
    getPeriodLedger(vendorId, start, endExclusive, ['SALE']),
    getStockSnapshot(vendorId, start, endExclusive),
    getPeriodLedger(vendorId, start, endExclusive, ['SALE', 'RETURN']),
  ]);
  const totals = entries.reduce((result, entry) => ({
    sales: result.sales + entry.quantity,
    vendorPayableCents: result.vendorPayableCents + cents(entry.vendorPayable),
    companyMarginCents: result.companyMarginCents + cents(entry.companyNet),
  }), { sales: 0, vendorPayableCents: 0, companyMarginCents: 0 });
  return {
    entries,
    totals: {
      sales: qty(totals.sales),
      vendorPayable: totals.vendorPayableCents / 100,
      companyMargin: totals.companyMarginCents / 100,
    },
    stock: {
      openingStock: stock.openingStock,
      receipts: stock.receipts,
      closingStock: stock.closingStock,
      products: productBreakdown(stock.products, allEntries),
    },
  };
}

async function generateStatement(vendorId, startDate, endDate) {
  const { start, end, endExclusive } = periodBounds(startDate, endDate);
  const [stock, entries] = await Promise.all([
    getStockSnapshot(vendorId, start, endExclusive),
    getPeriodLedger(vendorId, start, endExclusive, ['SALE', 'RETURN']),
  ]);
  const salesEntries = entries.filter((entry) => entry.entryType === 'SALE');
  const returnEntries = entries.filter((entry) => entry.entryType === 'RETURN');
  const salesValueAtVendorPrice = salesEntries.reduce(
    (total, entry) => total + cents(entry.vendorPayable), 0,
  ) / 100;
  const returnValueAtVendorPrice = returnEntries.reduce(
    (total, entry) => total + cents(entry.vendorPayable), 0,
  ) / 100;

  return {
    periodStart: start,
    periodEnd: end,
    openingStock: stock.openingStock,
    receipts: stock.receipts,
    sales: qty(salesEntries.reduce((total, entry) => total + entry.quantity, 0)),
    returns: qty(returnEntries.reduce((total, entry) => total + entry.quantity, 0)),
    closingStock: stock.closingStock,
    products: productBreakdown(stock.products, entries),
    salesValueAtVendorPrice,
    netPayable: money(salesValueAtVendorPrice - returnValueAtVendorPrice),
  };
}

module.exports = {
  generateStatement,
  getLedger,
  money,
  periodBounds,
};
