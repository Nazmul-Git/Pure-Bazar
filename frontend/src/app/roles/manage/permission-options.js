export const permissionGroups = [
  {
    name: 'POS',
    rows: [{
      label: 'Sales, orders, returns, and shifts',
      read: ['pos:read', 'orders:read', 'returns:read', 'shifts:read'],
      write: ['pos:write', 'orders:write', 'returns:write', 'shifts:write'],
    }],
  },
  {
    name: 'Inventory',
    rows: [{
      label: 'Products, stock, warehouse, and transfers',
      read: ['products:read', 'categories:read', 'brands:read', 'units:read', 'stock:read', 'warehouse:read', 'stock:transfer:read'],
      write: ['products:write', 'categories:write', 'brands:write', 'units:write', 'stock:write', 'warehouse:write', 'stock:transfer:write', 'stock:transfer:receive'],
    }],
  },
  {
    name: 'Vendors',
    rows: [{ label: 'Vendor records', read: ['vendors:read'], write: ['vendors:write'] }],
  },
  {
    name: 'Finance',
    rows: [
      {
        label: 'Finance, expenses, payroll, and reports',
        read: ['finance:read', 'expenses:read', 'shareholders:read', 'wallet-logs:read', 'reports:read', 'reports:sales-stock:read', 'employees:read', 'payroll:read', 'salary-advances:read', 'expense-categories:read'],
        write: ['finance:write', 'expenses:write', 'wallet-logs:write', 'employees:write', 'payroll:write', 'salary-advances:write', 'expense-categories:write'],
      },
      { label: 'Vendor payouts (high risk)', read: ['vendor-payouts:read'], write: ['vendor-payouts:write'] },
    ],
  },
  {
    name: 'Settings',
    rows: [
      { label: 'Settings', read: ['settings:read'], write: ['settings:write'] },
      { label: 'Role administration', read: ['roles:read'], write: ['roles:write'] },
    ],
  },
  {
    name: 'Audit',
    rows: [{ label: 'Audit logs', read: ['auditlogs:read'], write: ['auditlogs:write'] }],
  },
];

export const sensitivePrefixes = ['settings:', 'roles:', 'vendor-payouts:', 'auditlogs:'];

export const presets = {
  Cashier: [
    'dashboard:read', 'pos:read', 'orders:read', 'returns:read', 'shifts:read',
    'pos:write', 'orders:write', 'returns:write', 'shifts:write',
  ],
  'Inventory Manager': [
    'dashboard:read', 'products:read', 'categories:read', 'brands:read', 'units:read',
    'stock:read', 'warehouse:read', 'stock:transfer:read',
    'products:write', 'categories:write', 'brands:write', 'units:write', 'stock:write',
    'warehouse:write', 'stock:transfer:write', 'stock:transfer:receive',
  ],
  Accountant: [
    'dashboard:read', 'finance:read', 'expenses:read', 'vendors:read', 'reports:read',
    'expenses:write',
  ],
};
