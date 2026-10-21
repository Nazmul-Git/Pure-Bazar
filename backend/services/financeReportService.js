const {
  DiscountLog, Expense, ExpenseCategory, Order, Product, Vendor, VendorLedger,
} = require('../models');
const {
  cents, money, sumCents, milli, qty, periodBounds, inPeriod, bucketKey, soldAt, byKey,
} = require('./reportUtils');

const paidOrders = async (bounds) => (await Order.find({ paymentStatus: 'PAID' }).lean())
  .filter((order) => inPeriod(soldAt(order), bounds));
const orderDiscount = (order) => cents(order.otherDiscountAmount) + cents(order.shareholderDiscountAmount);

async function vendorProfitability({ from, to } = {}) {
  const bounds = periodBounds({ from, to });
  const [entries, vendors] = await Promise.all([
    VendorLedger.find({}).lean(),
    Vendor.find({}).select('name shopName memberId').lean(),
  ]);
  const names = new Map(vendors.map((vendor) => [String(vendor._id), vendor]));
  const perVendor = new Map();
  entries.filter((entry) => inPeriod(entry.createdAt, bounds)).forEach((entry) => {
    const key = String(entry.vendorId);
    const sign = entry.entryType === 'RETURN' ? -1 : 1;
    const row = perVendor.get(key) || { quantity: 0, payable: 0, net: 0, bills: new Set() };
    row.quantity += sign * milli(entry.quantity);
    row.payable += sign * cents(entry.vendorPayable);
    row.net += cents(entry.companyNet);
    row.bills.add(String(entry.orderId));
    perVendor.set(key, row);
  });
  const rows = [...perVendor.entries()].map(([vendorId, row]) => {
    const vendor = names.get(vendorId) || {};
    return {
      vendorId,
      vendorName: vendor.name || 'Unknown vendor',
      shopName: vendor.shopName || null,
      memberId: vendor.memberId || null,
      billCount: row.bills.size,
      quantitySold: qty(row.quantity),
      vendorPayable: money(row.payable),
      companyNet: money(row.net),
      // Company net is margin minus discounts, so it is reported as the vendor's profitability.
      marginPercentOfPayable: row.payable > 0 ? Math.round((row.net / row.payable) * 10000) / 100 : null,
    };
  }).sort((a, b) => b.companyNet - a.companyNet || a.vendorName.localeCompare(b.vendorName));
  const totals = {
    quantitySold: qty(rows.reduce((sum, row) => sum + milli(row.quantitySold), 0)),
    vendorPayable: money(sumCents(rows, (row) => row.vendorPayable)),
    companyNet: money(sumCents(rows, (row) => row.companyNet)),
  };
  return { from: from || null, to: to || null, rows, totals };
}

async function profitLoss({ from, to } = {}) {
  const bounds = periodBounds({ from, to });
  const [orders, ledger, products, expenses, categories] = await Promise.all([
    paidOrders(bounds),
    VendorLedger.find({}).lean(),
    Product.find({}).select('vendorPrice').lean(),
    Expense.find({}).lean(),
    ExpenseCategory.find({}).lean(),
  ]);
  const cost = new Map(products.map((product) => [String(product._id), cents(product.vendorPrice)]));
  const orderIds = new Set(orders.map((order) => String(order._id)));
  const vendorShare = new Map();
  ledger.filter((entry) => entry.entryType === 'SALE' && orderIds.has(String(entry.orderId))).forEach((entry) => {
    const key = `${entry.orderId}|${entry.productId}`;
    vendorShare.set(key, (vendorShare.get(key) || 0) + cents(entry.vendorPayable));
  });

  let marginIncome = 0;
  let ownStockMargin = 0;
  orders.forEach((order) => order.lines.forEach((line) => {
    const share = vendorShare.get(`${order._id}|${line.productId}`);
    if (share !== undefined) {
      marginIncome += cents(line.subtotal) - share;
    } else {
      ownStockMargin += cents(line.subtotal) - Math.round((cost.get(String(line.productId)) || 0) * Number(line.quantity));
    }
  }));

  const discounts = orders.reduce((sum, order) => sum + orderDiscount(order), 0);
  const periodExpenses = expenses.filter((expense) => inPeriod(expense.expenseDate, bounds));
  const labels = new Map(categories.map((category) => [String(category._id), category.name]));
  const perCategory = new Map();
  periodExpenses.forEach((expense) => {
    const key = String(expense.categoryId);
    perCategory.set(key, (perCategory.get(key) || 0) + cents(expense.amount));
  });
  const totalExpenses = periodExpenses.reduce((sum, expense) => sum + cents(expense.amount), 0);

  return {
    from: from || null,
    to: to || null,
    marginIncome: money(marginIncome),
    ownStockMargin: money(ownStockMargin),
    discounts: money(discounts),
    expenses: money(totalExpenses),
    expensesByCategory: [...perCategory.entries()].map(([categoryId, total]) => ({
      categoryId, category: labels.get(categoryId) || 'Unknown', total: money(total),
    })).sort((a, b) => a.category.localeCompare(b.category)),
    netProfit: money(marginIncome + ownStockMargin - discounts - totalExpenses),
  };
}

async function vatDiscountReport({ from, to } = {}) {
  const bounds = periodBounds({ from, to });
  const [orders, logs] = await Promise.all([paidOrders(bounds), DiscountLog.find({}).lean()]);
  const days = new Map();
  orders.forEach((order) => {
    const key = bucketKey(soldAt(order), 'day');
    const row = days.get(key) || {
      period: key, billCount: 0, vat: 0, itemDiscount: 0, billDiscount: 0, shareholderDiscount: 0,
    };
    row.billCount += 1;
    row.vat += cents(order.vatAmount);
    row.itemDiscount += order.lines.reduce((sum, line) => sum + cents(line.itemDiscountAmount), 0);
    row.billDiscount += order.lines.reduce((sum, line) => sum + cents(line.billDiscountAmount), 0);
    row.shareholderDiscount += cents(order.shareholderDiscountAmount);
    days.set(key, row);
  });
  const rows = [...days.values()].sort(byKey).map((row) => ({
    period: row.period,
    billCount: row.billCount,
    vat: money(row.vat),
    itemDiscount: money(row.itemDiscount),
    billDiscount: money(row.billDiscount),
    shareholderDiscount: money(row.shareholderDiscount),
    totalDiscount: money(row.itemDiscount + row.billDiscount + row.shareholderDiscount),
  }));
  const total = (pick) => money(rows.reduce((sum, row) => sum + cents(pick(row)), 0));
  const orderIds = new Set(orders.map((order) => String(order._id)));
  const discountLog = { ITEM: 0, BILL: 0 };
  logs.filter((log) => orderIds.has(String(log.orderId))).forEach((log) => {
    discountLog[log.scope] += 1;
  });
  return {
    from: from || null,
    to: to || null,
    rows,
    totals: {
      billCount: rows.reduce((sum, row) => sum + row.billCount, 0),
      vat: total((row) => row.vat),
      itemDiscount: total((row) => row.itemDiscount),
      billDiscount: total((row) => row.billDiscount),
      shareholderDiscount: total((row) => row.shareholderDiscount),
      totalDiscount: total((row) => row.totalDiscount),
    },
    discountEntries: { item: discountLog.ITEM, bill: discountLog.BILL },
  };
}

module.exports = { vendorProfitability, profitLoss, vatDiscountReport };
