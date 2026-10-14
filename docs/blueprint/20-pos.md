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