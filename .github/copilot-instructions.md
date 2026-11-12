# PureBazar rules (read on every task)

- Project: PureBazar, offline inventory + POS (central warehouse, outlets, POS). Source of truth: docs/blueprint/*.md (split from docs/BLUEPRINT.md, Admin Guide v3.5). Never invent features outside it.
- Before each task read PROGRESS.md and ONLY the blueprint module files the prompt names.
- Stack: backend/ = Node, Express, MongoDB with Mongoose, JWT, joi, jest, supertest. frontend/ = Next.js App Router, Tailwind, Redux Toolkit, Axios, lucide-react. Folder structure is in docs/blueprint/00-core.md.
- Do only the task asked. Do not touch unrelated files. Keep every file under about 300 lines; split if bigger.
- Money: round to 2 decimals consistently. Never trust raw floating point sums.
- Stock changes only through stockmovements lines. Never write stock numbers directly. Every write action is audited. Validate input on every route. Secrets only in .env. Probashi APIs are called only from the server.
- Multi-outlet rule: every outlet-scoped record carries a location. Use the existing field names and never rename them: User.locationId, warehouseId on StockMovement, GoodsReceive, StockAdjustment, StockCount and StockTransfer, Order.outlet, Shift.outletId, Expense.locationId. Every user except Super Admin must have locationId (Central Warehouse or an outlet) and is locked to it; the server overrides any location sent by the client. Roles have an allowedLocationType setting (any, warehouse or outlet) and a user's location must match it. Super Admin has no location and may see all locations or select one. Locations come from the Location collection, not Settings.outlets. The product catalog is shared; stock and accounting are per location. Permission checks use authorizeMiddleware. Never hardcode role names beyond the existing Super Admin check.
- Do not break the existing central warehouse flow or existing tests.
- Write automated tests for what you build, run them yourself, and fix until they pass.
- Install dependencies yourself. Report results in plain English, briefly.
- When tests pass: tick the step in PROGRESS.md (files created, decisions) and git commit with the message '<step id> <step name>'.
- If you are running out of context, stop and say exactly what is done and what remains.