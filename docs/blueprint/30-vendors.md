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