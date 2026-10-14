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
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Inventory', href: '/inventory/products', icon: Package },
  { label: 'Sales (POS)', href: '/orders/pos', icon: ShoppingCart },
  { label: 'Vendors', href: '/vendors/directory', icon: BriefcaseBusiness },
  { label: 'Shareholders', href: '/shareholders/directory', icon: Users },
  { label: 'Roles', href: '/roles/manage', icon: BarChart3 },
  { label: 'Finance', href: '/finance/revenue', icon: CircleDollarSign },
  { label: 'Reports', href: '/reports/sales-stock', icon: ChartNoAxesCombined },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function getCurrentSection(pathname) {
  return navigationItems.find((item) => pathname.startsWith(item.href.split('/').slice(0, 2).join('/')))
    ?.label ?? 'Dashboard';
}