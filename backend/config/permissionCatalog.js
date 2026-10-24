// One entry per sidebar page. Granular keys are `<key>:read` / `<key>:write`.
// `read` / `write` list the legacy flags that existing route guards check;
// they are stored with the role so those guards keep working.
const page = (key, read = [], write = []) => ({ key, read, write });

const permissionCatalog = [
  page('inventory.products', ['products:read', 'categories:read', 'brands:read', 'units:read'],
    ['products:write', 'categories:write', 'brands:write', 'units:write']),
  page('inventory.grn', ['stock:read'], ['stock:write']),
  page('inventory.transfers', ['stock:transfer:read'], ['stock:transfer:write', 'stock:transfer:receive']),
  page('inventory.warehouse', ['warehouse:read'], ['warehouse:write']),
  page('inventory.adjustments', ['stock:read'], ['stock:write']),
  page('inventory.counts', ['stock:read'], ['stock:write']),
  page('inventory.barcodes', ['products:read'], []),
  page('pos.sales', ['pos:read'], ['pos:write']),
  page('pos.history', ['pos:read', 'orders:read'], ['orders:write']),
  page('pos.returns', ['pos:read', 'returns:read'], ['returns:write']),
  page('pos.shifts', ['shifts:read'], ['shifts:manage', 'shifts:write']),
  page('vendors.directory', ['vendors:read'], ['vendors:write']),
  page('vendors.ledger', ['vendors:read'], []),
  page('vendors.register', ['vendors:read'], ['vendors:write']),
  page('vendors.settlement', ['vendors:read', 'vendor-payouts:read'], ['vendor-payouts:write']),
  page('vendors.payout-history', ['vendor-payouts:read'], []),
  page('shareholders.directory', ['shareholders:read'], ['shareholders:write']),
  page('shareholders.wallet-logs', ['wallet-logs:read'], ['wallet-logs:write']),
  page('finance.revenue', ['finance:read'], ['finance:write']),
  page('finance.expenses', ['expenses:read'], ['expenses:write']),
  page('finance.payout-approval', ['vendors:read', 'vendor-payouts:read'], ['vendor-payouts:write']),
  page('finance.reconciliation', ['finance:read'], ['finance:write']),
  page('hr.employees', ['employees:read'], ['employees:write']),
  page('hr.salary-sheets', ['payroll:read'], ['payroll:write']),
  page('hr.payslips', ['payroll:read'], []),
  page('hr.advances', ['payroll:read', 'salary-advances:read'], ['payroll:write', 'salary-advances:write']),
  page('reports.sales'),
  page('reports.stock'),
  page('reports.vendor-profit'),
  page('reports.profit-loss'),
  page('reports.vat-discount'),
  page('system.audit-logs', ['auditlogs:read'], ['auditlogs:write']),
  page('system.expense-categories', ['expense-categories:read'], ['expense-categories:write']),
  page('system.settings-roles', ['settings:read', 'roles:read'], ['settings:write', 'roles:write']),
];

const granularPermissions = permissionCatalog.flatMap(({ key }) => [`${key}:read`, `${key}:write`]);

function expandPermissions(permissions = []) {
  const expanded = new Set(permissions);
  permissionCatalog.forEach(({ key, read, write }) => {
    if (expanded.has(`${key}:read`)) read.forEach((permission) => expanded.add(permission));
    if (expanded.has(`${key}:write`)) {
      write.forEach((permission) => expanded.add(permission));
      read.forEach((permission) => expanded.add(permission));
    }
  });
  return [...expanded];
}

module.exports = { permissionCatalog, granularPermissions, expandPermissions };
