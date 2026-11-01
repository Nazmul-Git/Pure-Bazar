# PureBazar Go-Live Checklist

This checklist covers the operational, financial, and technical steps to complete before launching PureBazar in production. Items requiring company or accountant decisions should be confirmed with the responsible people before go-live.

## 1. Merchant Account and Financial Settlement

- [ ] Confirm the corporate bank account and payment-gateway merchant ID used to settle online and card payments.
- [ ] Define how vendors are funded, who approves payouts, and the payout schedule (for example, weekly or monthly).
- [ ] Establish the process for refunding customers to their wallet or original payment method after a return or cancellation.

## 2. VAT and Accounting Rules

- [ ] Confirm applicable VAT rates and whether prices are VAT-inclusive or VAT-exclusive for each product category with the company accountant.
- [ ] Verify that POS receipts meet local tax requirements and show the required VAT breakdown.

## 3. Pricing Policy and Margin Governance

- [ ] Define and enforce minimum profit-margin rules for inventory items to prevent sales below cost.
- [ ] Restrict price updates in the system to authorized roles, such as Super Admin or Operations Manager.

## 4. Vendor Consignment and Terms

- [ ] Define consignment inventory ownership, commission splits, and settlement conditions.
- [ ] Document the terms for returning unsold or expired consignment stock to vendors.

## 5. Staff Training

- [ ] Train POS and cashier staff on barcode scanning, adding items to the cart, accepting multiple payment methods, and printing receipts.
- [ ] Train inventory staff on stock entry, transfer approvals, damaged-stock logging, and low-stock alerts.
- [ ] Verify that every employee uses their own assigned credentials to maintain audit trails.

## 6. Single-Outlet Pilot

1. **Setup:** Deploy to one selected pilot outlet and prepare the Xprinter thermal printer and barcode scanners.
2. **Parallel run:** Operate PureBazar alongside existing systems for 3–5 days and compare daily billing and stock counts.
3. **Review:** Review transaction logs, staff feedback, and speed bottlenecks before rollout to other outlets.

## 7. In-House System Verification and Deployment

- [ ] On the backend server, verify production configuration in the production `.env`, including the database URL, JWT secret, server port, and CORS origins. Do not copy secret values into this checklist or other documentation.
- [ ] Confirm external verification toggles remain disabled or unlinked, as PureBazar is intended to operate fully in-house.
- [ ] Restart the backend service and verify it is running in the live production environment.
