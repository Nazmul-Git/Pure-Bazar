const {
  GoodsReceive, Order, Product, Settings, Shift, StockAdjustment, StockMovement,
} = require('../models');
const { getDashboard, dhakaBounds, lowStockAlerts, DEFAULT_LOW_STOCK_THRESHOLD } = require('./dashboardService');

const RECENT_LIMIT = 10;
const FAST_MOVING_DAYS = 30;
const FAST_MOVING_LIMIT = 5;
const REORDER_COVER_FACTOR = 2;

const ADMIN_ROLES = ['Super Admin', 'Owner'];
const CASHIER_ROLES = ['Cashier', 'Outlet Cashier'];
const INVENTORY_ROLES = ['Inventory Manager'];

const cents = (value) => Math.round((Number(value) + Number.EPSILON) * 100);
const money = (totalCents) => totalCents / 100;
const sumCents = (items, pick) => items.reduce((sum, item) => sum + cents(pick(item) || 0), 0);
const soldTime = (order) => new Date(order.soldAt || order.createdAt).getTime();

function resolveDashboardView(user) {
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  if (permissions.includes('*') || ADMIN_ROLES.includes(user?.role)) return 'admin';
  if (CASHIER_ROLES.includes(user?.role)) return 'cashier';
  if (INVENTORY_ROLES.includes(user?.role)) return 'inventory';
  return 'general';
}

function methodTotals(orders) {
  const totals = {};
  orders.forEach((order) => order.payments.forEach((payment) => {
    totals[payment.method] = (totals[payment.method] || 0) + cents(payment.amount);
  }));
  return totals;
}

async function getCashierDashboard(user, now) {
  const { dayStart, dayEnd } = dhakaBounds(now);
  const [orders, shift, settings] = await Promise.all([
    Order.find({ cashier: user._id, paymentStatus: 'PAID' }).lean(),
    Shift.findOne({ cashierId: user._id, status: 'OPEN' }).lean(),
    Settings.findOne({}).lean(),
  ]);
  const mine = orders.filter((order) => String(order.cashier) === String(user._id));
  const today = mine.filter((order) => soldTime(order) >= dayStart.getTime() && soldTime(order) < dayEnd.getTime());
  const byMethod = methodTotals(today);
  const salesCents = sumCents(today, (order) => order.grandTotal);
  const targetCents = cents(settings?.dailySalesTarget || 0);

  let shiftSummary = null;
  if (shift) {
    const shiftOrders = mine.filter((order) => soldTime(order) >= new Date(shift.openedAt).getTime());
    const cashCents = methodTotals(shiftOrders).CASH || 0;
    shiftSummary = {
      openedAt: shift.openedAt,
      openingCash: money(cents(shift.openingCash)),
      cashSales: money(cashCents),
      expectedCash: money(cents(shift.openingCash) + cashCents),
      billCount: shiftOrders.length,
    };
  }

  return {
    view: 'cashier',
    todaySales: money(salesCents),
    dailySalesTarget: money(targetCents),
    targetProgressPercent: targetCents > 0 ? Math.min(100, Math.round((salesCents / targetCents) * 1000) / 10) : null,
    todayBillCount: today.length,
    paymentSplit: {
      cash: money(byMethod.CASH || 0),
      bkash: money(byMethod.BKASH || 0),
      card: money(byMethod.CARD || 0),
      other: money((byMethod.NAGAD || 0) + (byMethod.WALLET || 0)),
    },
    shift: shiftSummary,
    recentBills: [...today].sort((a, b) => soldTime(b) - soldTime(a)).slice(0, RECENT_LIMIT).map((order) => ({
      id: String(order._id),
      orderNumber: order.orderNumber,
      soldAt: order.soldAt || order.createdAt,
      itemCount: (order.lines || []).length,
      grandTotal: money(cents(order.grandTotal)),
      methods: [...new Set(order.payments.map((payment) => payment.method))],
    })),
    generatedAt: now,
  };
}

async function getInventoryDashboard(now, lowStockThreshold = DEFAULT_LOW_STOCK_THRESHOLD) {
  const [alerts, pendingGrns, adjustments, movements, products] = await Promise.all([
    lowStockAlerts(lowStockThreshold),
    GoodsReceive.find({ status: 'Draft' }).lean(),
    StockAdjustment.find({}).sort({ createdAt: -1 }).lean(),
    StockMovement.find({ type: 'SALE' }).lean(),
    Product.find({}).select('name barcode').lean(),
  ]);
  const since = now.getTime() - FAST_MOVING_DAYS * 24 * 60 * 60 * 1000;
  const sold = new Map();
  movements
    .filter((movement) => new Date(movement.createdAt || now).getTime() >= since)
    .forEach((movement) => {
      const key = String(movement.productId);
      sold.set(key, (sold.get(key) || 0) + Math.abs(cents(movement.quantity)));
    });
  const names = new Map(products.map((product) => [String(product._id), product]));
  const fastMoving = [...sold.entries()]
    .filter(([productId]) => names.has(productId))
    .map(([productId, total]) => ({ productId, productName: names.get(productId).name, soldQuantity: total / 100 }))
    .sort((a, b) => b.soldQuantity - a.soldQuantity || a.productName.localeCompare(b.productName))
    .slice(0, FAST_MOVING_LIMIT);

  const stockOut = alerts.filter((alert) => alert.quantity <= 0);
  const lowStock = alerts.filter((alert) => alert.quantity > 0);
  const reorderRecommendations = alerts.map((alert) => ({
    ...alert,
    suggestedQuantity: money(Math.max(0, cents(lowStockThreshold * REORDER_COVER_FACTOR) - cents(alert.quantity))),
  })).slice(0, RECENT_LIMIT);

  return {
    view: 'inventory',
    lowStockThreshold,
    lowStockCount: lowStock.length,
    stockOutCount: stockOut.length,
    lowStockAlerts: alerts.slice(0, RECENT_LIMIT),
    pendingGrnCount: pendingGrns.length,
    pendingGrns: pendingGrns.slice(0, 5).map((grn) => ({
      id: String(grn._id), vendorChallanNumber: grn.vendorChallanNumber || null,
      ownerType: grn.ownerType, lineCount: (grn.lines || []).length, createdAt: grn.createdAt,
    })),
    reorderRecommendations,
    fastMoving,
    pendingAdjustmentCount: adjustments.filter((item) => item.status === 'Pending').length,
    recentAdjustments: adjustments.slice(0, 5).map((item) => ({
      id: String(item._id), reason: item.reason, status: item.status,
      lineCount: (item.lines || []).length, createdAt: item.createdAt,
    })),
    generatedAt: now,
  };
}

async function getDashboardForUser(user, { now = new Date(), lowStockThreshold } = {}) {
  const view = resolveDashboardView(user);
  if (view === 'admin') return { view, ...(await getDashboard({ now, lowStockThreshold })) };
  if (view === 'cashier') return getCashierDashboard(user, now);
  if (view === 'inventory') return getInventoryDashboard(now, lowStockThreshold);
  return { view: 'general', generatedAt: now };
}

module.exports = { getDashboardForUser, resolveDashboardView };
