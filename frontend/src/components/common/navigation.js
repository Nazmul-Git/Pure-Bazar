import {
  Banknote,
  Barcode,
  BarChart3,
  BookOpen,
  Boxes,
  Building2,
  Calculator,
  CheckCheck,
  CircleDollarSign,
  Clock,
  ClipboardCheck,
  CreditCard,
  FileSearch,
  FileSpreadsheet,
  FileText,
  HandCoins,
  History,
  LayoutDashboard,
  LineChart,
  Package,
  Percent,
  PieChart,
  Receipt,
  RotateCcw,
  Scale,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sliders,
  Store,
  Tags,
  TrendingUp,
  Truck,
  ArrowLeftRight,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';

// Parent groups have `children`; a group's `href` is its first destination.
export const navigationItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permissions: ['dashboard:read'] },
  {
    label: 'Inventory',
    href: '/inventory/products',
    icon: Package,
    children: [
      { label: 'Products', href: '/inventory/products', icon: Package, permissions: ['products:read'] },
      { label: 'Goods Receive / GRN', href: '/inventory/goods-receives', icon: Truck, permissions: ['stock:read'] },
      { label: 'Outlet Transfers', href: '/inventory/transfers', icon: ArrowLeftRight, permissions: ['stock:transfer:read'] },
      { label: 'Central Warehouse', href: '/inventory/warehouse', icon: Building2, permissions: ['warehouse:read'] },
      { label: 'Stock Adjustment', href: '/inventory/stock-adjustments', icon: Sliders, permissions: ['stock:read'] },
      { label: 'Stock Count', href: '/inventory/stock-counts', icon: ClipboardCheck, permissions: ['stock:read'] },
      { label: 'Barcode & Labels', href: '/inventory/barcodes', icon: Barcode, permissions: ['products:read'] },
    ],
  },
  {
    label: 'Sales & POS',
    href: '/orders/pos',
    icon: ShoppingCart,
    children: [
      { label: 'Sales POS', href: '/orders/pos', icon: ShoppingCart, permissions: ['pos:read'] },
      { label: 'Sales History', href: '/orders/history', icon: Receipt, permissions: ['pos:read'] },
      { label: 'Returns & Exchanges', href: '/orders/returns', icon: RotateCcw, permissions: ['pos:read'] },
      { label: 'Cashier Shift / Day Close', href: '/orders/shifts', icon: Clock, permissions: ['shifts:manage'] },
    ],
  },
  {
    label: 'Vendors',
    href: '/vendors/directory',
    icon: Store,
    children: [
      { label: 'Vendor Directory', href: '/vendors/directory', icon: Users, permissions: ['vendors:read'] },
      { label: 'Vendor Ledger & Earnings', href: '/vendors/ledger', icon: BookOpen, permissions: ['vendors:read'] },
      { label: 'Register Vendor', href: '/vendors/register', icon: UserPlus, permissions: ['vendors:write'] },
      { label: 'Settlement & Payout', href: '/vendors/payouts', icon: CreditCard, permissions: ['vendors:read'] },
      { label: 'Payout History', href: '/vendors/payouts/history', icon: History, permissions: ['vendor-payouts:read'] },
    ],
  },
  {
    label: 'Shareholders',
    href: '/shareholders/directory',
    icon: Users,
    children: [
      { label: 'Directory', href: '/shareholders/directory', icon: UserCheck, permissions: ['shareholders:read'] },
      { label: 'Wallet Bill Log', href: '/shareholders/wallet-logs', icon: FileText, permissions: ['wallet-logs:read'] },
    ],
  },
  {
    label: 'Finance',
    href: '/finance/revenue',
    icon: CircleDollarSign,
    children: [
      { label: 'Revenue Ledger', href: '/finance/revenue', icon: TrendingUp, permissions: ['finance:read'] },
      { label: 'Expenses', href: '/finance/expenses', icon: Receipt, permissions: ['expenses:read'] },
      { label: 'Payout Approval', href: '/finance/batch-payout', icon: CheckCheck, permissions: ['vendors:read'] },
      { label: 'Wallet Reconciliation', href: '/finance/wallet-reconciliation', icon: Scale, permissions: ['finance:read'] },
    ],
  },
  {
    label: 'HR & Payroll',
    href: '/payroll/employees',
    icon: UserCheck,
    children: [
      { label: 'Employees', href: '/payroll/employees', icon: Users, permissions: ['employees:read'] },
      { label: 'Salary Sheet / Payroll', href: '/payroll/salary-sheets', icon: Banknote, permissions: ['payroll:read'] },
      { label: 'Payslips', href: '/payroll/payslips', icon: FileSpreadsheet, permissions: ['payroll:read'] },
      { label: 'Advances', href: '/payroll/advances', icon: HandCoins, permissions: ['payroll:read'] },
    ],
  },
  {
    label: 'Reports',
    href: '/reports/sales-stock',
    icon: BarChart3,
    children: [
      { label: 'Sales Report', href: '/reports/sales-stock', icon: LineChart, permissions: ['reports:read', 'reports:sales-stock:read'] },
      { label: 'Stock Report', href: '/reports/stock', icon: Boxes, permissions: ['reports:read', 'reports:sales-stock:read'] },
      { label: 'Vendor Profitability', href: '/reports/vendor-profit', icon: PieChart, permissions: ['reports:read'] },
      { label: 'Profit and Loss', href: '/reports/profit-loss', icon: Calculator, permissions: ['reports:read'] },
      { label: 'VAT & Discounts', href: '/reports/vat-discount', icon: Percent, permissions: ['reports:read'] },
    ],
  },
  {
    label: 'Settings & System',
    href: '/roles/manage',
    icon: Settings,
    children: [
      { label: 'Roles & Permissions', href: '/roles/manage', icon: ShieldCheck, permissions: ['*'] },
      { label: 'Audit Trail', href: '/reports/audit-trail', icon: FileSearch, permissions: ['*'] },
      { label: 'Expense Categories', href: '/finance/expenses', icon: Tags, permissions: ['expense-categories:read'], noActive: true },
      { label: 'General Settings', href: '/settings', icon: Settings, permissions: ['*'] },
    ],
  },
];

export const routePermissions = [
  { prefix: '/dashboard', permissions: ['dashboard:read'] },
  { prefix: '/inventory/products', permissions: ['products:read'] },
  { prefix: '/inventory/categories', permissions: ['categories:read'] },
  { prefix: '/inventory/brands', permissions: ['brands:read'] },
  { prefix: '/inventory/units', permissions: ['units:read'] },
  { prefix: '/inventory/warehouse', permissions: ['stock:read'] },
  { prefix: '/inventory/goods-receives', permissions: ['stock:read'] },
  { prefix: '/inventory/transfers', permissions: ['stock:transfer:read'] },
  { prefix: '/inventory/barcodes', permissions: ['products:read'] },
  { prefix: '/inventory/stock-adjustments', permissions: ['stock:read'] },
  { prefix: '/inventory/stock-counts', permissions: ['stock:read'] },
  { prefix: '/orders/pos', permissions: ['pos:read'] },
  { prefix: '/orders/history', permissions: ['pos:read'] },
  { prefix: '/orders/returns', permissions: ['pos:read'] },
  { prefix: '/orders/shifts', permissions: ['shifts:manage'] },
  { prefix: '/vendors/directory', permissions: ['vendors:read'] },
  { prefix: '/vendors/register', permissions: ['vendors:write'] },
  { prefix: '/vendors/ledger', permissions: ['vendors:read', 'vendor-payouts:read'] },
  { prefix: '/vendors/payouts/history', permissions: ['vendor-payouts:read'] },
  { prefix: '/vendors/payouts', permissions: ['vendors:read'] },
  { prefix: '/shareholders/directory', permissions: ['shareholders:read'] },
  { prefix: '/shareholders/wallet-logs', permissions: ['wallet-logs:read'] },
  { prefix: '/finance/revenue', permissions: ['finance:read'] },
  { prefix: '/finance/expenses', permissions: ['expenses:read'] },
  { prefix: '/finance/batch-payout', permissions: ['vendors:read'] },
  { prefix: '/finance/wallet-reconciliation', permissions: ['finance:read'] },
  { prefix: '/payroll/employees', permissions: ['employees:read'] },
  { prefix: '/payroll/salary-sheets', permissions: ['payroll:read'] },
  { prefix: '/payroll/payslips', permissions: ['payroll:read'] },
  { prefix: '/payroll/advances', permissions: ['payroll:read'] },
  { prefix: '/reports/sales-stock', permissions: ['reports:read', 'reports:sales-stock:read'] },
  { prefix: '/reports/stock', permissions: ['reports:read', 'reports:sales-stock:read'] },
  { prefix: '/reports/vendor-profit', permissions: ['reports:read'] },
  { prefix: '/reports/profit-loss', permissions: ['reports:read'] },
  { prefix: '/reports/vat-discount', permissions: ['reports:read'] },
  { prefix: '/reports/audit-trail', permissions: ['*'] },
  { prefix: '/roles', permissions: ['*'] },
  { prefix: '/settings', permissions: ['*'] },
];

export const pageKeys = {
  '/inventory/products': 'inventory.products',
  '/inventory/goods-receives': 'inventory.grn',
  '/inventory/transfers': 'inventory.transfers',
  '/inventory/warehouse': 'inventory.warehouse',
  '/inventory/stock-adjustments': 'inventory.adjustments',
  '/inventory/stock-counts': 'inventory.counts',
  '/inventory/barcodes': 'inventory.barcodes',
  '/orders/pos': 'pos.sales',
  '/orders/history': 'pos.history',
  '/orders/returns': 'pos.returns',
  '/orders/shifts': 'pos.shifts',
  '/vendors/directory': 'vendors.directory',
  '/vendors/ledger': 'vendors.ledger',
  '/vendors/register': 'vendors.register',
  '/vendors/payouts/history': 'vendors.payout-history',
  '/vendors/payouts': 'vendors.settlement',
  '/shareholders/directory': 'shareholders.directory',
  '/shareholders/wallet-logs': 'shareholders.wallet-logs',
  '/finance/revenue': 'finance.revenue',
  '/finance/expenses': 'finance.expenses',
  '/finance/batch-payout': 'finance.payout-approval',
  '/finance/wallet-reconciliation': 'finance.reconciliation',
  '/payroll/employees': 'hr.employees',
  '/payroll/salary-sheets': 'hr.salary-sheets',
  '/payroll/payslips': 'hr.payslips',
  '/payroll/advances': 'hr.advances',
  '/reports/sales-stock': 'reports.sales',
  '/reports/stock': 'reports.stock',
  '/reports/vendor-profit': 'reports.vendor-profit',
  '/reports/profit-loss': 'reports.profit-loss',
  '/reports/vat-discount': 'reports.vat-discount',
};

export function getPageKey(pathname) {
  const prefix = Object.keys(pageKeys)
    .sort((a, b) => b.length - a.length)
    .find((candidate) => pathname === candidate || pathname.startsWith(`${candidate}/`));
  return prefix ? pageKeys[prefix] : undefined;
}

export function getRoutePermissions(pathname) {
  return routePermissions.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    ?.permissions || ['dashboard:read'];
}

export function getCurrentSection(pathname) {
  const matches = (href) => pathname === href || pathname.startsWith(`${href}/`);
  const exact = navigationItems.find((item) => matches(item.href)
    || item.children?.some((child) => !child.noActive && matches(child.href)));
  if (exact) return exact.label;
  return navigationItems.find((item) => pathname.startsWith(item.href.split('/').slice(0, 2).join('/')))
    ?.label ?? 'Dashboard';
}