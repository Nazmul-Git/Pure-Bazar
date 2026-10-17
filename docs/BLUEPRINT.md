# PureBazar Blueprint (from Admin Guide v3.5 main architecture)

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
PRICING: Product has ownerType (COMPANY | VENDOR), vendorId, vendorPrice,
mrp (mrp >= vendorPrice), margin (mrp - vendorPrice) (calculated). Warn
if margin < max shareholder discount (5% of MRP). Price changes:
authorized roles only, saved in pricehistory + audit, affect future
sales only. Category commission % exists but is OFF
(commissionEnabled=false) and unused.
STOCK: Never edit stock directly. Every change is a stockmovements line
(who, when, why, type: GRN, SALE, RETURN, TRANSFER_OUT, TRANSFER_IN,
ADJUSTMENT, COUNT). Current stock = sum of movements. Approval + stock
update = one DB transaction.
GRN: Draft, Approved, Rejected. Vendor or Company purchase. Product
search limited to that vendor. Existing product adds quantity to the
same product (no duplicates). Received/accepted/rejected quantities,
vendor challan number. Stock increases only on approval; approved GRN is
not editable (fix with Stock Adjustment).
TRANSFER: Requested, Dispatched, Received (confirmed by outlet),
Discrepancy.
ADJUSTMENT: reason mandatory; Super Admin approval above a set value;
logged. STOCK COUNT posts difference as adjustment.
POS BILL ORDER: Subtotal (at MRP) - other discounts -
shareholder
discount (computed after other discounts) = discounted amount; VAT on
discounted amount; Total. Round to 2 decimals. Order can be changed in
Settings.
SHAREHOLDER DISCOUNT: default 5% from Settings; applies ONLY when
payment method is WALLET and a verified shareholder is attached.
WALLET: Current Balance only; never Generation Bonus. Wallet pays the
whole bill (no split with wallet). Cashier sees only sufficient / not
sufficient. If not sufficient: reject wallet, return to MRP pricing,
choose another method. Non-wallet methods (CASH, BKASH, NAGAD, CARD) can
be split among themselves. Customer pays on the Probashi side; PureBazar
creates no payment request and needs no transaction ID. Probashi APIs
called only from the server: Member Verify, Wallet Balance Check,
Transaction Report, Refund (to be confirmed).
OTHER DISCOUNTS: item-wise or bill-wise, percent or fixed, reason
mandatory; above role limit needs Super Admin approval; every discount
written to discountlogs and audit.
VAT: Settings on/off, default %, product-wise and category-wise %,
vatApplicable flag; separate receipt line; VAT is not company income.
LEDGER per bill line: vendor payable = vendorPrice x qty (discounts
never reduce it); company net = (mrp - vendorPrice) x qty - discounts
(can be negative); company-owned products: MRP is income minus
discounts. Return reverses lines and returns stock.
ORDER fields: channel, subtotal, otherDiscountAmount,
otherDiscountReason, shareholderDiscountAmount, vatAmount, grandTotal,
payments [{method, amount}], paymentStatus (PAID, REFUNDED), memberId,
cashier, outlet. Finalizing a bill = ONE transaction: order PAID, stock
reduced, ledger lines, wallet log (if wallet), member id stored.
OFFLINE: Cash/bKash/Nagad/Card billing continues without internet and
syncs later; shareholder verify and wallet need internet.
VENDORS: Form A (shareholder ID, name, mobile, shop name, address,
product category, payout method + account details, terms checkbox with
version). On save call Member Verify; create only if valid, active,
wallet-enabled. Status Active/Suspended/Closed (suspended: can still
sell, no new GRN).
SETTLEMENT: Cycle 1 or 2 times a month (Settings). Statement: Draft,
Approved, Paid (unique number; opening stock, receipts, sales, returns,
closing stock, sales value at Vendor Price, net payable). Paid is
locked; corrections go in next period. Payment direct
(Cash/Bank/bKash/Nagad) with method, reference, date, receiver; linked
to GRN by settlementRef. Vendor wallet payout = future, OFF
(vendorWalletPayoutEnabled=false).
FINANCE: Revenue ledger (VAT shown separately), payout approval,
expenses, payroll (salary sheet Draft/Approved/Paid creates one expense
per sheet; closed months never edited), mandatory daily wallet
reconciliation vs Probashi report (Pending/Matched/Mismatch).
SHIFT: opening cash, closing cash, expected vs actual, report by payment
method.
REPORTS: sales and stock, vendor profitability (Excel/PDF), expense and
profit/Loss (margin income + own-stock margin - discounts - expenses),
VAT and discount report, audit trail.
SETTINGS: shareholderDiscountPercent (5), vatEnabled, defaultVatRate,
vat price mode, calculation order, discount limit by role, enabled
payment methods, receipt layout, vendor terms (versions), Probashi
credentials/status, outlets, vendorSettlementCyclePerMonth, cut-off
dates, enabled vendor payout methods, commissionEnabled=false,
vendorWalletPayoutEnabled=false.
DASHBOARD: total sales, margin income, today's sales + bill count,
today's split by payment method, wallet bill total, low-stock alerts,
recent activity, vendor payables due, this month's expenses.
QUALITY RULES: money stored as integer paisa or rounded to 2 decimals
consistently; every write action audited; input validation on every
route; passwords hashed; secrets only in .env; every module ships with
automated tests.
UI: Take look, layout and components ONLY from ui-reference/ (cloned
repo). Logic comes from this blueprint, not from the UI repo.