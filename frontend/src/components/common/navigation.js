import {
  BarChart3,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  CircleDollarSign,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Users,
} from 'lucide-react';

export const navigationItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permissions: ['dashboard:read'] },
  {
    label: 'Inventory',
    href: '/inventory/products',
    icon: Package,
    permissions: ['products:read', 'categories:read', 'brands:read', 'units:read', 'stock:read', 'warehouse:read'],
  },
  { label: 'Sales (POS)', href: '/orders/pos', icon: ShoppingCart, permissions: ['pos:read', 'orders:read'] },
  { label: 'Vendors', href: '/vendors/directory', icon: BriefcaseBusiness, permissions: ['vendors:read', 'vendor-payouts:read'] },
  { label: 'Shareholders', href: '/shareholders/directory', icon: Users, permissions: ['shareholders:read', 'wallet-logs:read'] },
  { label: 'Roles', href: '/roles/manage', icon: BarChart3, permissions: ['*'] },
  { label: 'Finance', href: '/finance/revenue', icon: CircleDollarSign, permissions: ['finance:read', 'expenses:read'] },
  { label: 'Reports', href: '/reports/sales-stock', icon: ChartNoAxesCombined, permissions: ['reports:read', 'reports:sales-stock:read'] },
  { label: 'Settings', href: '/settings', icon: Settings, permissions: ['settings:read'] },
];

export const routePermissions = [
  { prefix: '/dashboard', permissions: ['dashboard:read'] },
  { prefix: '/inventory/products', permissions: ['products:read'] },
  { prefix: '/inventory/categories', permissions: ['categories:read'] },
  { prefix: '/inventory/brands', permissions: ['brands:read'] },
  { prefix: '/inventory/units', permissions: ['units:read'] },
  { prefix: '/inventory/warehouse', permissions: ['warehouse:read', 'stock:read'] },
  { prefix: '/inventory/barcodes', permissions: ['products:read'] },
  { prefix: '/orders/pos', permissions: ['pos:read'] },
  { prefix: '/orders/history', permissions: ['orders:read'] },
  { prefix: '/orders/returns', permissions: ['returns:read'] },
  { prefix: '/vendors/directory', permissions: ['vendors:read'] },
  { prefix: '/vendors/ledger', permissions: ['vendors:read', 'vendor-payouts:read'] },
  { prefix: '/vendors/payouts', permissions: ['vendor-payouts:read'] },
  { prefix: '/shareholders/directory', permissions: ['shareholders:read'] },
  { prefix: '/shareholders/wallet-logs', permissions: ['wallet-logs:read'] },
  { prefix: '/finance/revenue', permissions: ['finance:read'] },
  { prefix: '/finance/batch-payout', permissions: ['vendor-payouts:read', 'finance:read'] },
  { prefix: '/reports/sales-stock', permissions: ['reports:read', 'reports:sales-stock:read'] },
  { prefix: '/reports/vendor-profit', permissions: ['reports:read'] },
  { prefix: '/roles', permissions: ['*'] },
  { prefix: '/settings', permissions: ['settings:read'] },
];

export function getRoutePermissions(pathname) {
  return routePermissions.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    ?.permissions || ['dashboard:read'];
}

export function getCurrentSection(pathname) {
  return navigationItems.find((item) => pathname.startsWith(item.href.split('/').slice(0, 2).join('/')))
    ?.label ?? 'Dashboard';
}