const {
  Location, Product, StockMovement, Vendor, VendorLedger,
} = require('../models');

const cents = (value) => Math.round((Number(value) + Number.EPSILON) * 100);
const money = (value) => cents(value || 0) / 100;
const qty = (value) => Math.round(((Number(value) || 0) + Number.EPSILON) * 1000) / 1000;

function statusError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function dateBounds(startDate, endDate) {
  const range = {};
  if (startDate) range.$gte = new Date(`${startDate}T00:00:00.000Z`);
  if (endDate) {
    const endExclusive = new Date(`${endDate}T00:00:00.000Z`);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    range.$lt = endExclusive;
  }
  return Object.keys(range).length ? range : null;
}

async function stockByProduct(productIds, centralIds, range) {
  const rows = await StockMovement.aggregate([
    { $match: { productId: { $in: productIds } } },
    {
      $group: {
        _id: '$productId',
        warehouse: { $sum: { $cond: [{ $in: ['$warehouseId', centralIds] }, '$quantity', 0] } },
        outlets: { $sum: { $cond: [{ $in: ['$warehouseId', centralIds] }, 0, '$quantity'] } },
        received: {
          $sum: {
            $cond: [{
              $and: [
                { $eq: ['$type', 'GRN'] },
                ...(range?.$gte ? [{ $gte: ['$createdAt', range.$gte] }] : []),
                ...(range?.$lt ? [{ $lt: ['$createdAt', range.$lt] }] : []),
              ],
            }, '$quantity', 0],
          },
        },
      },
    },
  ]);
  return new Map(rows.map((row) => [row._id.toString(), row]));
}

async function salesByProduct(vendorId, range) {
  const rows = await VendorLedger.aggregate([
    { $match: { vendorId, ...(range ? { createdAt: range } : {}) } },
    {
      $group: {
        _id: '$productId',
        soldQty: { $sum: { $cond: [{ $eq: ['$entryType', 'SALE'] }, '$quantity', { $multiply: ['$quantity', -1] }] } },
        payableCents: {
          $sum: {
            $multiply: [
              { $round: [{ $multiply: ['$vendorPayable', 100] }, 0] },
              { $cond: [{ $eq: ['$entryType', 'SALE'] }, 1, -1] },
            ],
          },
        },
      },
    },
  ]);
  return new Map(rows.map((row) => [row._id.toString(), row]));
}

async function getVendorOverview(vendorId, { startDate, endDate } = {}) {
  const vendor = await Vendor.findById(vendorId).lean();
  if (!vendor) throw statusError('Vendor not found', 404);
  if (startDate && endDate && startDate > endDate) {
    throw statusError('startDate must not be after endDate', 400);
  }
  const range = dateBounds(startDate, endDate);
  const products = await Product.find({ ownerType: 'VENDOR', vendorId })
    .select('name barcode vendorPrice mrp').sort({ name: 1 }).lean();
  const productIds = products.map((product) => product._id);
  const centralIds = (await Location.find({ type: 'CENTRAL' }).select('_id').lean()).map((item) => item._id);
  const [stock, sales] = await Promise.all([
    stockByProduct(productIds, centralIds, range),
    salesByProduct(vendor._id, range),
  ]);

  const rows = products.map((product) => {
    const key = product._id.toString();
    const stockRow = stock.get(key) || {};
    const sale = sales.get(key) || {};
    const warehouseStock = qty(stockRow.warehouse);
    const outletStock = qty(stockRow.outlets);
    const currentStock = qty(warehouseStock + outletStock);
    return {
      productId: key,
      name: product.name,
      barcode: product.barcode,
      unitPrice: money(product.vendorPrice),
      mrp: money(product.mrp),
      receivedQty: qty(stockRow.received),
      warehouseStock,
      outletStock,
      currentStock,
      soldQty: qty(sale.soldQty),
      valuation: money(Math.round(currentStock * cents(product.vendorPrice)) / 100),
      payable: (sale.payableCents || 0) / 100,
    };
  });
  const sum = (field) => rows.reduce((total, row) => total + row[field], 0);

  return {
    vendor: {
      id: vendor._id.toString(),
      name: vendor.name,
      memberId: vendor.memberId,
      shopName: vendor.shopName,
      productCategory: vendor.productCategory,
      mobile: vendor.mobile,
      email: vendor.email,
      address: vendor.address,
      status: vendor.status,
    },
    period: { startDate: startDate || null, endDate: endDate || null },
    products: rows,
    summary: {
      totalProducts: rows.length,
      totalAvailableStock: qty(sum('currentStock')),
      totalSoldUnits: qty(sum('soldQty')),
      totalValuation: money(sum('valuation')),
      totalPayable: money(sum('payable')),
    },
  };
}

module.exports = { getVendorOverview };
