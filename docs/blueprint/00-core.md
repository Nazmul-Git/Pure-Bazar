SCOPE: Offline only: central warehouse + outlets + POS. No online store,
no delivery, no vendor portal, no customer accounts. Keep a channel field on orders (value POS) and listedOnline (false) on products for
the future.
STACK: Monorepo purebazarv1/ with backend/ (Node, Express, MongoDB via
Mongoose, JWT) and frontend/ (Next.js App Router, Tailwind). Folders:
backend/{config, controllers, middlewares, models, routes, services, utils, seeders}; frontend/src/{app, components, hooks, services, store, utils, styles}.
DATABASE purebazarv1 (13 base collections): users, roles, categories,
brands, units, products, warehousestocks, orders, returns, vendors,
vendorledgers, shareholders, walletauditlogs (walletlogs is the wallet
bill log). New collections: goodsreceives, stocktransfers,
stockadjustments, stockcounts, stockmovements, vendorstatements, shifts,
employees, salarysheets, salaryadvances, expensecategories, expenses,
discountlogs, pricehistory, settings, auditlogs.
ROLES: Super Admin, Inventory Manager, Warehouse Staff, Outlet Cashier,
Finance, HR/Payroll. Menu and API permissions per role.

QUALITY RULES: money stored as integer paisa or rounded to 2 decimals
consistently; every write action audited; input validation on every
route; passwords hashed; secrets only in .env; every module ships with
automated tests.
UI: Take look, layout and components ONLY from ui-reference/ (cloned
repo). Logic comes from this blueprint, not from the UI repo.