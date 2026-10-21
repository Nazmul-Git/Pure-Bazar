import {
  BarChart3,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  CircleDollarSign,
  ClipboardList,
  ClipboardPlus,
  ArrowLeftRight,
  ScanBarcode,
  ClipboardCheck,
  SlidersHorizontal,
  Clock3,
  RotateCcw,
  LayoutDashboard,
  List,
  Package,
  Settings,
  ShoppingCart,
  ReceiptText,
  Users,
  UserPlus,
} from 'lucide-react';

export const navigationItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permissions: ['dashboard:read'] },
  {
    label: 'Inventory',
    href: '/inventory/products',
    icon: Package,
    permissions: ['products:read', 'categories:read', 'brands:read', 'units:read', 'stock:read', 'warehouse:read', 'stock:transfer:read'],
    children: [
      { label: 'Products', href: '/inventory/products', icon: Package, permissions: ['products:read'] },
      { label: 'Goods Receive', href: '/inventory/goods-receives', icon: ClipboardPlus, permissions: ['stock:read'] },
      { label: 'Outlet Transfers', href: '/inventory/transfers', icon: ArrowLeftRight, permissions: ['stock:transfer:read'] },
      { label: 'Central Warehouse', href: '/inventory/warehouse', icon: List, permissions: ['warehouse:read'] },
      { label: 'Stock Adjustment', href: '/inventory/stock-adjustments', icon: SlidersHorizontal, permissions: ['stock:read'] },
      { label: 'Stock Count', href: '/inventory/stock-counts', icon: ClipboardCheck, permissions: ['stock:read'] },
      { label: 'Barcode & Labels', href: '/inventory/barcodes', icon: ScanBarcode, permissions: ['products:read'] },
    ],
  },
  {
    label: 'Sales (POS)',
    href: '/orders/pos',
    icon: ShoppingCart,
    permissions: ['pos:read'],
    children: [
      { label: 'Sales history', href: '/orders/history', icon: ReceiptText, permissions: ['pos:read'] },
      { label: 'Returns & exchanges', href: '/orders/returns', icon: RotateCcw, permissions: ['pos:read'] },
      { label: 'Cashier shift / day close', href: '/orders/shifts', icon: Clock3, permissions: ['shifts:manage'] },
    ],
  },
  {
    label: 'Vendors',
    href: '/vendors/directory',
    icon: BriefcaseBusiness,
    permissions: ['vendors:read', 'vendors:write', 'vendor-payouts:read'],
    children: [
      { label: 'Vendor Directory', href: '/vendors/directory', icon: BriefcaseBusiness, permissions: ['vendors:read'] },
      { label: 'Vendor Ledger & Earnings', href: '/vendors/ledger', icon: ChartNoAxesCombined, permissions: ['vendors:read'] },
      { label: 'Register Vendor', href: '/vendors/register', icon: UserPlus, permissions: ['vendors:write'] },
      { label: 'Settlement & Payout', href: '/vendors/payouts', icon: CircleDollarSign, permissions: ['vendors:read'] },
      { label: 'Payout History', href: '/vendors/payouts/history', icon: ReceiptText, permissions: ['vendor-payouts:read'] },
    ],
  },
  { label: 'Shareholders', href: '/shareholders/directory', icon: Users, permissions: ['shareholders:read', 'wallet-logs:read'] },
  { label: 'Roles', href: '/roles/manage', icon: BarChart3, permissions: ['*'] },
  { label: 'Finance', href: '/finance/revenue', icon: CircleDollarSign, permissions: ['finance:read', 'expenses:read'] },
  {
    label: 'Reports',
    href: '/reports/sales-stock',
    icon: ChartNoAxesCombined,
    permissions: ['reports:read', 'reports:sales-stock:read'],
    children: [{ label: 'Audit Trail', href: '/reports/audit-trail', icon: ClipboardList, permissions: ['*'] }],
  },
  { label: 'Settings', href: '/settings', icon: Settings, permissions: ['*'] },
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
  { prefix: '/finance/batch-payout', permissions: ['vendor-payouts:read', 'finance:read'] },
  { prefix: '/reports/sales-stock', permissions: ['reports:read', 'reports:sales-stock:read'] },
  { prefix: '/reports/vendor-profit', permissions: ['reports:read'] },
  { prefix: '/reports/audit-trail', permissions: ['*'] },
  { prefix: '/roles', permissions: ['*'] },
  { prefix: '/settings', permissions: ['*'] },
];

export function getRoutePermissions(pathname) {
  return routePermissions.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    ?.permissions || ['dashboard:read'];
}

export function getCurrentSection(pathname) {
  return navigationItems.find((item) => pathname.startsWith(item.href.split('/').slice(0, 2).join('/')))
    ?.label ?? 'Dashboard';
}