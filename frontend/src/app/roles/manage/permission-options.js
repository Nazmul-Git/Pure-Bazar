export const permissionGroups = [
  {
    name: 'Dashboard',
    rows: [{ label: 'Dashboard', read: ['dashboard:read'], write: [] }],
  },
  {
    name: 'POS',
    rows: [
      {
        label: 'Sales, orders, and returns',
        read: ['pos:read', 'orders:read', 'returns:read'],
        write: ['pos:write', 'orders:write', 'returns:write'],
      },
      { label: 'Cashier shift / day close', read: [], write: ['shifts:manage'] },
    ],
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
        label: 'Finance, expenses, and wallet logs',
        read: ['finance:read', 'expenses:read', 'wallet-logs:read'],
        write: ['finance:write', 'expenses:write', 'wallet-logs:write'],
      },
      { label: 'Vendor payouts (high risk)', read: ['vendor-payouts:read'], write: ['vendor-payouts:write'] },
    ],
  },
  {
    name: 'Reports',
    rows: [
      { label: 'Reports', read: ['reports:read'], write: [] },
      { label: 'Sales and stock reports', read: ['reports:sales-stock:read'], write: [] },
    ],
  },
  {
    name: 'Shareholders',
    rows: [{
      label: 'Shareholders',
      read: ['shareholders:read'],
      write: ['shareholders:write'],
    }],
  },
  {
    name: 'HR & Employees',
    rows: [
      {
        label: 'Employees',
        read: ['employees:read'],
        write: ['employees:write'],
      },
      {
        label: 'Payroll',
        read: ['payroll:read', 'salary-advances:read'],
        write: ['payroll:write', 'salary-advances:write'],
      },
    ],
  },
  {
    name: 'Expense Categories',
    rows: [{
      label: 'Expense categories',
      read: ['expense-categories:read'],
      write: ['expense-categories:write'],
    }],
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
    'dashboard:read', 'pos:read', 'orders:read', 'returns:read',
    'pos:write', 'orders:write', 'returns:write', 'shifts:manage',
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
