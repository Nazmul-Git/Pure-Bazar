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

async function getStockSnapshot(vendorId, start, endExclusive) {
  const products = await Product.find({ ownerType: 'VENDOR', vendorId })
    .select('_id')
    .lean();
  const productIds = products.map((product) => product._id);
  if (!productIds.length) {
    return { openingStock: 0, receipts: 0, closingStock: 0 };
  }

  const [snapshot] = await StockMovement.aggregate([
    {
      $match: {
        productId: { $in: productIds },
        createdAt: { $lt: endExclusive },
      },
    },
    {
      $group: {
        _id: null,
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
  return {
    openingStock: snapshot?.openingStock || 0,
    receipts: snapshot?.receipts || 0,
    closingStock: snapshot?.closingStock || 0,
  };
}

async function getLedger(vendorId, start, endExclusive) {
  const entries = await getPeriodLedger(vendorId, start, endExclusive, ['SALE']);
  const totals = entries.reduce((result, entry) => ({
    sales: result.sales + entry.quantity,
    vendorPayableCents: result.vendorPayableCents + cents(entry.vendorPayable),
    companyMarginCents: result.companyMarginCents + cents(entry.companyNet),
  }), { sales: 0, vendorPayableCents: 0, companyMarginCents: 0 });
  return {
    entries,
    totals: {
      sales: totals.sales,
      vendorPayable: totals.vendorPayableCents / 100,
      companyMargin: totals.companyMarginCents / 100,
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
    sales: salesEntries.reduce((total, entry) => total + entry.quantity, 0),
    returns: returnEntries.reduce((total, entry) => total + entry.quantity, 0),
    closingStock: stock.closingStock,
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
