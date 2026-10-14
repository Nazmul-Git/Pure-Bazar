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