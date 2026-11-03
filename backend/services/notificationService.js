const {
  StockCount, StockAdjustment, StockTransfer, GoodsReceive, VendorStatement, WalletReconciliation, SalarySheet, SalaryAdvance,
} = require('../models');
const { lowStockAlerts, DEFAULT_LOW_STOCK_THRESHOLD } = require('./dashboardService');

const ITEM_LIMIT = 10;

const can = (user, permission) => {
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  return permissions.includes('*') || permissions.includes(permission);
};

const asList = async (query) => (query && typeof query.lean === 'function' ? query.lean() : query);

function group(key, type, label, href, severity, rows, describe) {
  const list = rows || [];
  return {
    key, type, label, href, severity, count: list.length,
    items: list.slice(0, ITEM_LIMIT).map((row) => ({
      id: String(row._id || row.productId),
      title: describe(row),
      href,
      createdAt: row.createdAt || null,
    })),
  };
}

async function getNotifications(user, { lowStockThreshold = DEFAULT_LOW_STOCK_THRESHOLD } = {}) {
  const canStock = can(user, 'stock:read');
  const canTransfer = can(user, 'stock:transfer:read');
  const canPayout = can(user, 'vendor-payouts:read');
  const canFinance = can(user, 'finance:read');
  const canPayroll = can(user, 'payroll:read');
  const canAdvance = canPayroll && can(user, 'salary-advances:read');
  const [counts, adjustments, grns, transfers, lowStock, draftPayouts, approvedPayouts, reconciliations, sheets, advances] = await Promise.all([
    canStock ? asList(StockCount.find({ status: 'PendingApproval' })) : [],
    canStock ? asList(StockAdjustment.find({ status: 'Pending' })) : [],
    canStock ? asList(GoodsReceive.find({ status: 'Draft' })) : [],
    canTransfer ? asList(StockTransfer.find({ status: { $in: ['Requested', 'Dispatched'] } })) : [],
    canStock ? lowStockAlerts(lowStockThreshold) : [],
    canPayout ? asList(VendorStatement.find({ status: 'Draft' })) : [],
    canPayout && canFinance ? asList(VendorStatement.find({ status: 'Approved' })) : [],
    canFinance ? asList(WalletReconciliation.find({ status: { $in: ['Pending', 'Mismatch'] } })) : [],
    canPayroll ? asList(SalarySheet.find({ status: 'Draft' })) : [],
    canAdvance ? asList(SalaryAdvance.find({ status: 'Draft' })) : [],
  ]);

  const groups = [
    group('stock-counts', 'STOCK_COUNT', 'Stock counts awaiting approval', '/inventory/stock-counts', 'warning', counts,
      () => 'Stock count pending approval'),
    group('stock-adjustments', 'STOCK_ADJUSTMENT', 'Stock adjustments awaiting approval', '/inventory/stock-adjustments', 'warning', adjustments,
      (row) => `Stock adjustment pending${row.reason ? `: ${row.reason}` : ''}`),
    group('transfers', 'TRANSFER', 'Outlet transfers pending', '/inventory/transfers', 'info', transfers,
      (row) => (row.status === 'Dispatched' ? 'Transfer in transit - awaiting receipt' : 'Transfer requested - awaiting dispatch')),
    group('goods-receives', 'GRN', 'GRNs awaiting approval', '/inventory/goods-receives', 'warning', grns,
      () => 'Goods receive pending approval'),
    group('low-stock', 'LOW_STOCK', 'Low stock warnings', '/inventory/warehouse', 'danger', lowStock,
      (row) => `${row.productName}: ${Math.floor(Number(row.quantity))} left`),
    group('vendor-payouts', 'VENDOR_PAYOUT', 'Vendor payout requests awaiting approval', '/vendors/payouts', 'warning', draftPayouts,
      (row) => `Vendor payout request pending${row.statementNumber ? `: ${row.statementNumber}` : ''}`),
    group('payout-approvals', 'PAYOUT_APPROVAL', 'Approved payouts awaiting payment', '/finance/batch-payout', 'warning', approvedPayouts,
      (row) => `Payout approved - awaiting payment${row.statementNumber ? `: ${row.statementNumber}` : ''}`),
    group('wallet-reconciliation', 'CASH_RECONCILIATION', 'Wallet reconciliation alerts', '/finance/wallet-reconciliation', 'danger', reconciliations,
      (row) => (row.status === 'Mismatch' ? 'Wallet reconciliation mismatch' : 'Wallet reconciliation pending')),
    group('salary-sheets', 'SALARY_SHEET', 'Salary sheets awaiting approval', '/payroll/salary-sheets', 'warning', sheets,
      (row) => `Salary sheet pending approval${row.month ? `: ${row.month}` : ''}`),
    group('salary-advances', 'SALARY_ADVANCE', 'Employee advance requests', '/payroll/advances', 'warning', advances,
      () => 'Salary advance request pending'),
  ].filter((entry) => entry.count > 0);

  return { total: groups.reduce((sum, entry) => sum + entry.count, 0), groups };
}

module.exports = { getNotifications };
