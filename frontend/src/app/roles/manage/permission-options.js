// Mirrors backend/config/permissionCatalog.js. `lr` / `lw` are the legacy flags
// used to pre-check pages for roles saved before page-level permissions existed.
const row = (key, label, lr = [], lw = []) => ({
  key,
  label,
  read: [`${key}:read`],
  write: [`${key}:write`],
  lr,
  lw,
});

export const permissionGroups = [
  {
    name: 'Dashboard',
    rows: [{ key: 'dashboard', label: 'Dashboard', read: ['dashboard:read'], write: [], lr: [], lw: [] }],
  },
  {
    name: 'Inventory',
    rows: [
      row('inventory.products', 'Products', ['products:read', 'categories:read', 'brands:read', 'units:read'],
        ['products:write', 'categories:write', 'brands:write', 'units:write']),
      row('inventory.grn', 'Goods Receive (GRN)', ['stock:read'], ['stock:write']),
      row('inventory.transfers', 'Outlet Transfers', ['stock:transfer:read'], ['stock:transfer:write', 'stock:transfer:receive']),
      row('inventory.warehouse', 'Central Warehouse', ['warehouse:read'], ['warehouse:write']),
      row('inventory.adjustments', 'Stock Adjustment', ['stock:read'], ['stock:write']),
      row('inventory.counts', 'Stock Count', ['stock:read'], ['stock:write']),
      row('inventory.barcodes', 'Barcode & Labels', ['products:read']),
    ],
  },
  {
    name: 'POS & Orders',
    rows: [
      row('pos.sales', 'Sales (POS)', ['pos:read'], ['pos:write']),
      row('pos.history', 'Sales History', ['pos:read', 'orders:read'], ['orders:write']),
      row('pos.returns', 'Returns & Exchanges', ['pos:read', 'returns:read'], ['returns:write']),
      row('pos.shifts', 'Cashier Shift / Day Close', ['shifts:read'], ['shifts:manage', 'shifts:write']),
    ],
  },
  {
    name: 'Vendors',
    rows: [
      row('vendors.directory', 'Vendor Directory', ['vendors:read'], ['vendors:write']),
      row('vendors.ledger', 'Vendor Ledger & Earnings', ['vendors:read']),
      row('vendors.register', 'Register Vendor', ['vendors:read'], ['vendors:write']),
      row('vendors.settlement', 'Settlement & Payout', ['vendors:read', 'vendor-payouts:read'], ['vendor-payouts:write']),
      row('vendors.payout-history', 'Payout History', ['vendor-payouts:read']),
    ],
  },
  {
    name: 'Shareholders',
    rows: [
      row('shareholders.directory', 'Shareholder Directory', ['shareholders:read'], ['shareholders:write']),
      row('shareholders.wallet-logs', 'Wallet Bill Log', ['wallet-logs:read'], ['wallet-logs:write']),
    ],
  },
  {
    name: 'Finance',
    rows: [
      row('finance.revenue', 'Revenue Ledger', ['finance:read'], ['finance:write']),
      row('finance.expenses', 'Expenses', ['expenses:read'], ['expenses:write']),
      row('finance.payout-approval', 'Payout Approval', ['vendors:read', 'vendor-payouts:read'], ['vendor-payouts:write']),
      row('finance.reconciliation', 'Wallet Reconciliation', ['finance:read'], ['finance:write']),
    ],
  },
  {
    name: 'HR / Payroll',
    rows: [
      row('hr.employees', 'Employees', ['employees:read'], ['employees:write']),
      row('hr.salary-sheets', 'Salary Sheet / Payroll', ['payroll:read'], ['payroll:write']),
      row('hr.payslips', 'Payslips', ['payroll:read']),
      row('hr.advances', 'Advances', ['payroll:read', 'salary-advances:read'], ['payroll:write', 'salary-advances:write']),
    ],
  },
  {
    name: 'Reports',
    rows: [
      row('reports.sales', 'Sales Report', ['reports:read']),
      row('reports.stock', 'Stock Report', ['reports:read']),
      row('reports.vendor-profit', 'Vendor Profitability', ['reports:read']),
      row('reports.profit-loss', 'Profit and Loss', ['reports:read']),
      row('reports.vat-discount', 'VAT and Discounts', ['reports:read']),
    ],
  },
  {
    name: 'System & Audit',
    rows: [
      row('system.audit-logs', 'Audit Trail / Logs', ['auditlogs:read'], ['auditlogs:write']),
      row('system.expense-categories', 'Expense Categories', ['expense-categories:read'], ['expense-categories:write']),
      row('system.settings-roles', 'Settings & Roles Administration', ['settings:read', 'roles:read'], ['settings:write', 'roles:write']),
    ],
  },
];

export const sensitivePrefixes = [
  'settings:', 'roles:', 'vendor-payouts:', 'auditlogs:',
  'system.', 'vendors.settlement', 'vendors.payout-history', 'finance.payout-approval',
];

const allRows = permissionGroups.flatMap((group) => group.rows);

// Convert a stored role (legacy and/or page-level flags) into the page-level flags the form edits.
export function toFormPermissions(stored = []) {
  const has = new Set(stored);
  const selected = new Set(stored.filter((permission) => (
    allRows.some((item) => item.read.includes(permission) || item.write.includes(permission))
  )));
  allRows.forEach((item) => {
    if (item.lr.length && item.lr.every((permission) => has.has(permission))) selected.add(item.read[0]);
    if (item.lw.length && item.lw.every((permission) => has.has(permission))) selected.add(item.write[0]);
  });
  if (has.has('reports:sales-stock:read')) {
    selected.add('reports.sales:read');
    selected.add('reports.stock:read');
  }
  return [...selected];
}

export const presets = {
  Cashier: [
    'dashboard:read', 'pos.sales:read', 'pos.sales:write', 'pos.history:read', 'pos.history:write',
    'pos.returns:read', 'pos.returns:write', 'pos.shifts:read', 'pos.shifts:write',
  ],
  'Inventory Manager': [
    'dashboard:read',
    ...['products', 'grn', 'transfers', 'warehouse', 'adjustments', 'counts', 'barcodes']
      .flatMap((page) => [`inventory.${page}:read`, `inventory.${page}:write`]),
  ],
  Accountant: [
    'dashboard:read', 'finance.revenue:read', 'finance.expenses:read', 'finance.expenses:write',
    'finance.reconciliation:read', 'vendors.directory:read',
    'reports.sales:read', 'reports.stock:read', 'reports.vendor-profit:read',
    'reports.profit-loss:read', 'reports.vat-discount:read',
  ],
};
