# Multi-outlet rules

## Locations
- Location model: type CENTRAL or OUTLET, isActive, isPrimary.
- Central Warehouse is a Location of type CENTRAL.

## Users and roles
- Every user except Super Admin must have User.locationId. Super Admin has none and is never locked.
- Role.allowedLocationType: any | warehouse (CENTRAL) | outlet (OUTLET). The user's location type must match.
- Only Super Admin can set or change locationId or allowedLocationType. Every change is audited.
- One role per user. The manual permission matrix is unchanged.

## Location scope
- middlewares/enforceLocationScope.js sets req.locationId.
  - Locked user: always their own locationId. Any locationId, outletId or warehouseId from query, body or params is overwritten.
  - Super Admin: selectedOutletId from query, else null (all locations).
- Login payload and /auth/me include locationId, location name and type.
- canManageLocation and hasGlobalStockAccess enforce the user's location (Super Admin unrestricted).

## Field names (never rename)
| Model | Field |
|---|---|
| StockMovement, GoodsReceive, StockAdjustment, StockCount | warehouseId |
| StockTransfer | fromWarehouseId, toWarehouseId |
| Order | outlet |
| Shift | outletId |
| Expense, User, VendorLedger | locationId |

## Stock
- Stock = sum of StockMovement rows per warehouseId. Never write stock numbers directly.
- GRN is allowed at any active location. Approval writes GRN movements in one transaction.
- Transfers: create only from own location, receive only into own location.
- The product catalog is shared. Product has no location field.

## Accounting
- Vendor ledger, expenses, shifts, revenue and reports are per location.
- Records without a location are treated as the central warehouse. Old data is not modified.
- billEngine and price rules are unchanged.

## Rollout order
P1 user location, P2 outlet GRN, P3 POS scope, P4 dashboard, P5 inventory and transfers, P6 product edit, P7 accounting, P8 UI lock.