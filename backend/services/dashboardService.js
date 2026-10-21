const {
  AuditLog, Expense, Order, Product, StockMovement, VendorLedger, VendorStatement,
} = require('../models');

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
const DEFAULT_LOW_STOCK_THRESHOLD = 10;
const RECENT_ACTIVITY_LIMIT = 10;
const LOW_STOCK_LIMIT = 50;

const cents = (value) => Math.round((Number(value) + Number.EPSILON) * 100);
const money = (totalCents) => totalCents / 100;
const sumCents = (items, pick) => items.reduce((sum, item) => sum + cents(pick(item) || 0), 0);

// Asia/Dhaka calendar day and month boundaries, expressed as UTC instants.
function dhakaBounds(now) {
  const local = new Date(now.getTime() + DHAKA_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();
  const at = (year, month, day) => new Date(Date.UTC(year, month, day) - DHAKA_OFFSET_MS);
  return {
    dayStart: at(y, m, d),
    dayEnd: at(y, m, d + 1),
    monthStart: at(y, m, 1),
    monthEnd: at(y, m + 1, 1),
  };
}

const soldTime = (order) => new Date(order.soldAt || order.createdAt).getTime();

async function lowStockAlerts(threshold) {
  const [movements, products] = await Promise.all([
    StockMovement.find({}).lean(),
    Product.find({}).select('name barcode').lean(),
  ]);
  const quantities = new Map();
  movements.forEach((movement) => {
    const key = String(movement.productId);
    quantities.set(key, (quantities.get(key) || 0) + cents(movement.quantity));
  });
  const names = new Map(products.map((product) => [String(product._id), product]));
  return [...quantities.entries()]
    .filter(([productId, total]) => names.has(productId) && total / 100 <= threshold)
    .map(([productId, total]) => ({
      productId,
      productName: names.get(productId).name,
      barcode: names.get(productId).barcode,
      quantity: total / 100,
    }))
    .sort((a, b) => a.quantity - b.quantity || a.productName.localeCompare(b.productName))
    .slice(0, LOW_STOCK_LIMIT);
}

async function getDashboard({ now = new Date(), lowStockThreshold = DEFAULT_LOW_STOCK_THRESHOLD } = {}) {
  const { dayStart, dayEnd, monthStart, monthEnd } = dhakaBounds(now);
  const [orders, ledger, statements, expenses, recent, lowStock] = await Promise.all([
    Order.find({ paymentStatus: 'PAID' }).lean(),
    VendorLedger.find({}).lean(),
    VendorStatement.find({ status: 'Approved' }).lean(),
    Expense.find({}).lean(),
    AuditLog.find({}).sort({ createdAt: -1 }).lean(),
    lowStockAlerts(lowStockThreshold),
  ]);

  const today = orders.filter((order) => soldTime(order) >= dayStart.getTime()
    && soldTime(order) < dayEnd.getTime());
  const todayByMethod = {};
  today.forEach((order) => order.payments.forEach((payment) => {
    todayByMethod[payment.method] = (todayByMethod[payment.method] || 0) + cents(payment.amount);
  }));
  const monthExpenses = expenses.filter((expense) => new Date(expense.expenseDate) >= monthStart
    && new Date(expense.expenseDate) < monthEnd);

  return {
    totalSales: money(sumCents(orders, (order) => order.grandTotal)),
    marginIncome: money(sumCents(ledger, (entry) => entry.companyNet)),
    todaySales: money(sumCents(today, (order) => order.grandTotal)),
    todayBillCount: today.length,
    todayByPaymentMethod: Object.fromEntries(
      Object.entries(todayByMethod).sort(([a], [b]) => a.localeCompare(b))
        .map(([method, total]) => [method, money(total)]),
    ),
    walletBillTotal: money(todayByMethod.WALLET || 0),
    lowStockThreshold,
    lowStockAlerts: lowStock,
    recentActivity: recent.slice(0, RECENT_ACTIVITY_LIMIT).map((log) => ({
      id: String(log._id), action: log.action, entity: log.entity, entityId: log.entityId || null,
      actorId: log.actorId || null, createdAt: log.createdAt,
    })),
    vendorPayablesDue: money(sumCents(statements, (statement) => statement.netPayable)),
    monthExpenses: money(sumCents(monthExpenses, (expense) => expense.amount)),
    generatedAt: now,
  };
}

module.exports = { getDashboard, dhakaBounds, DEFAULT_LOW_STOCK_THRESHOLD };
