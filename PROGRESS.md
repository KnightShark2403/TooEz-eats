# TooEz Eats — Progress

## Phase 0 — Repo audit
**Status:** Done, blocked on design assets before Phase 1 starts.

**Findings:**
- Repo is empty — no commits, no files, no existing stack, no auth, no models/routes.
- Design references (`/design/reference-dashboard.png`, `/design/reference-mobile.png`) not present anywhere on disk.

**Decisions (from user):**
- Stack: React (Vite) + Node/Express + SQLite. No external services, runs fully locally.
- Design refs: user will add the images before Phase 2/3 styling work starts. Proceeding on repo scaffolding (Phase 1) is fine in the meantime since it's backend-only.

**Assumption to flag:** repo has no existing auth. Building a full auth system is out of scope for this MVP per the hard constraints ("reuse existing auth — don't build a new auth system"). Proposed minimal stand-in: student identifies with just a name (no password), stored client-side, sent with each order so the app can filter "my orders." Will proceed with this unless told otherwise.

**Proposed file plan (Phases 1–6):**
```
/server
  package.json
  index.js            # Express app entry
  db.js                # SQLite init + schema (menu_items, orders, order_items)
  routes/menu.js        # GET /api/menu
  routes/orders.js       # POST /api/orders, GET /api/orders, PATCH /api/orders/:id/status
/web
  package.json
  src/
    main.jsx
    App.jsx             # router: "/" student app, "/dashboard" staff view
    student/
      MenuScreen.jsx
      CartScreen.jsx
      CheckoutScreen.jsx   # Phase 5 payment step
      OrderStatusScreen.jsx
    dashboard/
      KanbanBoard.jsx
      OrderCard.jsx
    lib/api.js           # fetch wrapper
    styles/tokens.css     # color tokens from brief
/design
  reference-dashboard.png   (pending)
  reference-mobile.png      (pending)
PROGRESS.md
```

**Next:** waiting on user go-ahead to start Phase 1 (backend order flow). Design images can land any time before Phase 2/3.

## Phase 1 — Backend order flow
**Status:** Done.

**Files touched:**
- `server/package.json` — express, cors, better-sqlite3
- `server/db.js` — SQLite schema: `menu_items`, `orders`, `order_items`; status enum `New / Accepted / Preparing / Ready for Pickup / Completed`
- `server/routes/menu.js` — `GET /api/menu`
- `server/routes/orders.js` — `POST /api/orders`, `GET /api/orders` (optional `?student_name=` filter), `PATCH /api/orders/:id/status`
- `server/index.js` — Express app entry, port 4000
- `.gitignore` — node_modules, sqlite db files

**How to run/verify:**
```
cd server && npm install && npm start
# server on http://localhost:4000, db file server/tooez.db created on first run (currently empty, no menu items yet)
```
Smoke-tested all four endpoints manually (menu list, create order, list orders, status update) — all working. Server prices are computed from the DB, not trusted from the client. No menu items are seeded yet — that's Phase 6 (demo polish).

**Stack decisions:** better-sqlite3 (sync, zero-config, no separate DB server to run for the demo). ESM (`type: module`) throughout.

**Open questions:** none blocking. Auth stand-in (name-only, no password) as flagged in Phase 0 — implemented as a plain `student_name` string field on orders, no session/auth middleware yet (that lands in Phase 2 on the client side).

**Next:** waiting on go-ahead for Phase 2 (student app screens). Design refs (`/design/reference-mobile.png`) still not present — will use token-only styling for now unless added first.

## Phase 2 — Student app screens
**Status:** Done, unverified visually (no browser tool available this session — see below).

**Files touched:**
- `design/reference-dashboard.png`, `design/reference-mobile.png` — moved in from repo root
- `web/package.json`, `web/vite.config.js`, `web/index.html` — Vite + React scaffold, `react-router-dom` added (smallest addition for multi-screen navigation)
- `web/src/styles/tokens.css` — color tokens from the brief, confirmed against both reference images
- `web/src/lib/api.js`, `web/src/lib/student.js`, `web/src/lib/useActiveOrder.js`, `web/src/lib/menuVisuals.js`
- `web/src/state/CartContext.jsx` — in-memory cart (no persistence, single session is enough for the demo)
- `web/src/student/NameGate.jsx` — name-only identity stand-in (flagged in Phase 0/1), gates the whole app
- `web/src/student/MenuScreen.jsx` — greeting header, live-order hero card, category pills, menu rows, mini-cart bar
- `web/src/student/CartScreen.jsx` — qty steppers, total, proceed to checkout
- `web/src/student/CheckoutScreen.jsx` — order review + Place Order button, calls `POST /api/orders` directly (Phase 5 will insert the stub payment loading→success step in front of this call — commented in the file)
- `web/src/student/OrderStatusScreen.jsx` — status hero, 5-step progress tracker, items, bottom tab bar
- `web/src/student/ProfileScreen.jsx` — shows name, "switch student" (clears identity, useful for demoing multiple students)
- `web/src/student/BottomTabBar.jsx`, `web/src/student/StatusPill.jsx`, `web/src/student/statuses.js`
- `web/src/App.jsx`, `web/src/main.jsx` — routing: `/`, `/cart`, `/checkout`, `/order/:id`, `/profile`

**How to run/verify:**
```
# terminal 1
cd server && npm start        # http://localhost:4000

# terminal 2
cd web && npm run dev         # http://localhost:5173
```
Seeded 4 sample menu items (Veg Thali, Veg Fried Rice, Grilled Sandwich, Cold Coffee) directly in the dev DB for testing — real seed data is Phase 6's job.

**Verification done:** `npm run build` succeeds with no errors (47 modules, catches import/syntax issues). Both dev servers boot cleanly with no console errors. **Not done:** no browser tool was available this session to click through the actual flow, so the UI hasn't been visually confirmed to render/behave correctly — please click through menu → cart → checkout → order status yourself at `localhost:5173` and flag anything broken.

**Note:** order status only fetches once on mount right now (no auto-refresh) — that's intentionally Phase 4's job.

**Open questions:** none blocking.

**Next:** waiting on go-ahead for Phase 3 (canteen dashboard).

## Phase 3 — Canteen dashboard
**Status:** Done, unverified visually (Chrome extension installed by user but not yet detected in this session — see below).

**Files touched:**
- `web/src/dashboard/OrderCard.jsx` — cream kitchen-ticket card (ref, elapsed time, student name, items, status badge, "Move to {next status}" button)
- `web/src/dashboard/KanbanBoard.jsx` — 5 columns (New/Accepted/Preparing/Ready for Pickup/Completed), each with a count badge and its orders
- `web/src/dashboard/DashboardScreen.jsx` — sidebar shell (brand + single "Orders" nav item — no other admin sections were built, since Phase 3 scope is the Kanban board only), header greeting, two honest stat chips (Orders today, In queue — both computed client-side from real order data, no fabricated revenue/table metrics)
- `web/src/lib/timeAgo.js`
- `web/src/App.jsx` — added `/dashboard` route, restructured so the student app (NameGate + CartProvider) only wraps student routes; dashboard has no student identity/cart concerns

**Scope note:** the reference dashboard image shows a full admin console (revenue charts, table occupancy, staff, inventory, floor plan). Per the hard constraints ("no advanced analytics, no complex admin systems") and Phase 3's actual scope ("Kanban board... order cards... staff can update status"), only the Kanban board was built. Visual language (dark theme, sidebar, card rounding, ticket-card styling, status colors) was pulled from the reference; the extra pages/widgets were not.

**How to run/verify:**
```
cd server && npm start   # http://localhost:4000
cd web && npm run dev    # http://localhost:5173/dashboard
```
Created 2 sample orders and advanced one through a status via curl to confirm the exact request/response shapes the dashboard's fetch and "Move to next status" button rely on — both work correctly end to end.

**Not done:** no browser tool was available this session (Chrome extension connects at the start of a new session), so the Kanban board hasn't been visually confirmed — please open `localhost:5173/dashboard` and check the columns/cards/status buttons render and work as expected.

**Note:** dashboard also only fetches once on mount — no live refresh yet, that's Phase 4.

**Open questions:** none blocking.

**Next:** waiting on go-ahead for Phase 4 (realtime status sync).

## Phase 4 — Realtime status sync
**Status:** Done.

**Mechanism:** polling — the stack (Express + SQLite, no pub/sub) has nothing a native realtime channel would trivially hook into, so per the brief this defaults to polling.

**Files touched:**
- `web/src/lib/usePolling.js` — small reusable hook: calls a fetcher immediately, then every `intervalMs`, cleans up on unmount/dep change
- `web/src/lib/useActiveOrder.js` — now polls every 4s (was fetch-once) so the menu screen's live-order hero card updates without a manual refresh
- `web/src/student/OrderStatusScreen.jsx` — now polls every 3s for the viewed order
- `web/src/dashboard/DashboardScreen.jsx` — now polls every 3s for all orders, so new orders land in the **New** column and staff-made status changes reflect on refetch

**How to verify:** with both servers running, place an order (student app) and watch it appear in the dashboard's New column within ~3s without refreshing; click "Move to Accepted →" on the dashboard and watch the student's order-status screen update within ~3s without refreshing.

**Not done:** still no visual confirmation in an actual browser this session (see Phase 2/3 notes) — build passes clean and both dev server logs show no errors after the HMR reload, but please click through the live-update behavior yourself.

**Open questions:** none blocking.

**Next:** waiting on go-ahead for Phase 5 (payment).

## Phase 5 — Payment
**Status:** Done.

**Approach:** no payment SDK/keys exist anywhere in this repo (confirmed in Phase 0's audit), so per the brief this is a stub checkout with a real-looking loading → success flow.

**Files touched:**
- `web/src/lib/paymentGateway.js` — stub `charge({ amountRupees })`, resolves after 1.4s with `{ success, paymentId }`. Commented as a stub and shaped like a real gateway client call so swapping in Stripe/Razorpay later only touches this one file, not call sites.
- `web/src/student/CheckoutScreen.jsx` — the "Place order" button is now "Pay · ₹total". Clicking it: calls the stub gateway → shows a spinner ("Processing payment…") → on success shows a checkmark ("Payment successful") → then creates the order via the existing `POST /api/orders` and navigates to the order-status screen. Cart review/summary UI unchanged.
- `web/src/styles/tokens.css` — added `.spinner` + `@keyframes spin` for the loading state.

**How to verify:** `cd web && npm run dev`, add items to cart, go to checkout, click Pay — should show ~1.4s spinner, then a brief checkmark, then land on the order-status screen with a real order created in the backend.

**Not done:** still no visual browser confirmation this session — build passes clean, HMR reload showed no errors.

**Open questions:** none blocking.

**Next:** waiting on go-ahead for Phase 6 (demo polish).

## Bugfix — dashboard showed no orders
**Status:** Fixed.

**Root cause:** `web/src/lib/api.js`'s `getOrders(studentName)` always appended `?student_name=${encodeURIComponent(studentName)}`. `DashboardScreen.jsx` called it with no argument, so `encodeURIComponent(undefined)` produced the literal string `"undefined"` — the request became `/orders?student_name=undefined`, which the backend correctly (from its point of view) filtered on and returned `[]` for. No error was thrown (valid 200, empty array), so nothing surfaced in the UI's error banner — the board just silently looked empty.

**Fix:** added `api.getAllOrders()` (unfiltered `GET /orders`) and pointed `DashboardScreen` at it instead. `getOrders(studentName)` is unchanged and still used correctly by the student app.

**Files touched:** `web/src/lib/api.js`, `web/src/dashboard/DashboardScreen.jsx`

**Verified:** curl reproduced the bug (`?student_name=undefined` → `[]`) and confirmed the fix (`/api/orders` unfiltered → real order data, including live orders created during this session's testing). Build passes clean.

## Phase 6 — Demo polish
**Status:** Done.

**Files touched:**
- `server/seed.js` (+ `npm run seed` in `server/package.json`) — clears menu/orders/order_items and inserts 13 realistic menu items across Mains, Rice & Bowls, Snacks, Beverages, Desserts, plus 5 sample orders pre-spread across all 5 statuses (New/Accepted/Preparing/Ready for Pickup/Completed, timestamped a few minutes to ~25 minutes in the past) so the dashboard looks alive the moment it's opened, without needing to place orders live first.
- `web/src/student/EmptyState.jsx` — new small shared component (icon + message + optional CTA button), styled to theme
- `web/src/student/CartScreen.jsx`, `CheckoutScreen.jsx`, `OrderStatusScreen.jsx` — swapped three unstyled default `<button>` empty/error states (cart-empty x2, order-not-found) for `EmptyState`. These were rendering as raw unstyled browser buttons, which is exactly what this phase's "not raw" instruction flags.

**Full demo-script walkthrough (via API, since browser tools weren't available this session):** ran all 5 steps live against the running server — list menu (13 items) → place order → confirm it appears in the dashboard's unfiltered order feed within 1s → advance through all 4 status transitions → confirm the student-filtered feed reflects the final status. All passed. Database was then re-seeded to leave a clean demo-ready state (5 sample orders spread across the board, ready to layer one live order on top during the actual demo).

**Not done:** still no visual browser confirmation this session — recommend clicking through once before Friday, especially the payment spinner→success timing and the Kanban card layout at real viewport widths.

**Open questions:** none blocking.

**Demo day quick-start:**
```
cd server && npm install && npm run seed && npm start   # http://localhost:4000
cd web && npm install && npm run dev                     # http://localhost:5173 (student), /dashboard (staff)
```

## Phase 7 — Fix: only one order trackable at a time
**Status:** Done.

**Diagnosis:** the backend was never the problem — `orders` has always been a real table keyed by student name, and `GET /api/orders?student_name=` correctly returns *all* of a student's orders. The bug was entirely client-side: `web/src/lib/useActiveOrder.js` did `orders.find(o => o.status !== "Completed")`, collapsing that list down to one "current order" object. It fed both the menu screen's live-order hero card and the bottom tab bar's quick-jump link. So placing a second order while the first was still active silently swapped the hero card/tab target to the new order — the first order still existed and was reachable if you knew its `/order/:id` URL, but nothing in the UI pointed at it anymore. Scope was confined to this one hook and its two consumers, so no rebuild of the tracking screen was needed and I didn't stop to confirm before patching, per the phase brief.

**Fix:**
- `web/src/lib/useActiveOrder.js` → renamed `web/src/lib/useActiveOrders.js`, now exports `useActiveOrders()` returning `{ activeOrders, loading }` — `.filter()` instead of `.find()`, so every non-Completed order survives.
- `web/src/student/MenuScreen.jsx` — hero section now maps over `activeOrders` and renders one card per active order (was a single card for one order), each independently linking to `/order/:id`. Bottom tab bar's quick-jump still targets the single most recent active order (`activeOrders[0]`), since that's a convenience shortcut, not the tracking mechanism itself.
- `web/src/student/OrderStatusScreen.jsx` and `web/src/student/BottomTabBar.jsx` — unchanged; `OrderStatusScreen` already fetched and displayed by `:id` from the full order list, so any order was already independently viewable once you could navigate to it — the gap was purely in getting there from the menu screen.

**How to verify:**
```
cd server && npm start
cd web && npm run dev
```
As one student, place an order, then (without waiting for it to complete) place a second order. Both should now show as separate "Live Order" cards on the menu screen, each linking to its own `/order/:id` status page and updating independently as staff advances each one on the dashboard.

Also verified directly against the API: created two `New` orders for the same test student, confirmed `GET /api/orders?student_name=...` returns both (it always did) — the fix ensures the frontend now surfaces both instead of only the most recent. `npm run build` passes clean (54 modules). No visual browser confirmation this session (see recurring note in earlier phases).

**Open questions:** none blocking.

**Next:** waiting on go-ahead for Phase 8 (convenience fee).

## Phase 8 — Convenience fee
**Status:** Done.

**Approach:** flat ₹10 per order, computed server-side (source of truth) and stored on the order itself rather than folded into `total_rupees` invisibly — added a `convenience_fee_rupees` column so every order (past and future) carries the exact fee it was charged, itemized separately from item totals everywhere a total is shown.

**Files touched:**
- `server/db.js` — `CONVENIENCE_FEE_RUPEES = 10` constant; `orders.convenience_fee_rupees` column added to the schema, plus a guarded `ALTER TABLE ... ADD COLUMN` migration (try/catch) so it also lands on the existing dev DB, not just fresh ones.
- `server/routes/orders.js` — `POST /api/orders` now computes `total = itemsTotal + CONVENIENCE_FEE_RUPEES` and stores the fee alongside it; server remains the sole source of truth for pricing (client never sends a total).
- `server/seed.js` — sample orders now include the fee too, so seeded totals match what a real order would produce.
- `web/src/lib/fees.js` — new `CONVENIENCE_FEE_RUPEES = 10` constant for display purposes on the client (server value is authoritative; this only mirrors it so the checkout screen can show the right numbers before the order exists).
- `web/src/student/CheckoutScreen.jsx` — order summary now has a "Convenience fee — ₹10" line above the total; the total, the "Pay · ₹—" button, and the amount passed to the stub payment gateway all use `payableRupees` (items + fee) instead of the cart's item-only `totalRupees`.
- `web/src/student/OrderStatusScreen.jsx` — receipt now itemizes "Convenience fee — ₹10" as its own line under the items, with a total line below it (`order.total_rupees`, fee-inclusive, straight from the server).
- `web/src/dashboard/OrderCard.jsx` — order ticket's item list now includes a "Convenience fee — ₹10" line; the total badge in the corner was already `order.total_rupees` and is now fee-inclusive automatically since that's computed server-side.

**Not touched:** `CartScreen.jsx` / `CartContext.jsx` — cart subtotal stays item-only, since the fee is scoped to "applied at checkout" per the brief; it first appears at the checkout screen's order summary.

**How to verify:**
```
cd server && npm install && npm run seed && npm start   # http://localhost:4000
cd web && npm install && npm run dev                     # http://localhost:5173
```
Add items to cart → checkout: summary shows items, then "Convenience fee — ₹10", then a total that's items + 10; the Pay button and processing-spinner amount match that total. After paying, the order-status receipt and the dashboard's order card both show the same fee line and fee-inclusive total.

Verified directly against the API: re-seeded the DB (sample orders now carry `convenience_fee_rupees: 10` and fee-inclusive totals) and posted a fresh order (2× ₹90 item → `total_rupees: 190` = 180 + 10, `convenience_fee_rupees: 10`). `npm run build` passes clean (55 modules). No visual browser confirmation this session.

**Open questions:** none blocking.

**Next:** waiting on go-ahead for Phase 9 (auth).

## Phase 9 — Auth (student + staff)
**Status:** Done.

**Approach:** no Supabase/Firebase/etc. exists anywhere in this stack (confirmed in Phase 0's audit — Node/Express/SQLite, fully local), so per the brief this is the lightest fitting library combo: `bcryptjs` for password hashing (pure JS, no native build step) + `jsonwebtoken` for stateless bearer tokens. No hand-rolled crypto or session store — both libraries do the actual work; the app code just calls them. Email + password (not phone) as the lighter of the two options. One `users` table with a `role` column (`student` | `staff`) covers both account types — no separate tables or permission matrix.

**Backend — files touched:**
- `server/package.json` — added `bcryptjs`, `jsonwebtoken`.
- `server/db.js` — new `users` table (`role`, `email` UNIQUE, `password_hash`, `name`); `orders.student_id` column (nullable FK to `users`) added via the same guarded-migration pattern as Phase 8's fee column.
- `server/auth.js` — new: `signToken(user)` (JWT, 30-day expiry, dev-only fallback secret via `JWT_SECRET` env var), `requireAuth(role)` middleware (verifies bearer token, 401 if missing/invalid, 403 if the account's role doesn't match the route's required role).
- `server/routes/auth.js` — new: `POST /api/auth/signup` and `POST /api/auth/login`, both take `{ role, email, password, name? }`. Login checks the stored user's role matches the requested role (a staff account can't log in through the student flow or vice versa) — this is what makes "separate login" a real server-side boundary, not just a UI convention.
- `server/routes/orders.js` — every route now requires auth: `POST /` and `GET /orders/mine` require `role: student` (order is attributed to `req.user.id`/`req.user.name` from the token, no longer a client-supplied `student_name`); `GET /` (full queue) and `PATCH /:id/status` require `role: staff`. The old `GET /orders?student_name=` filter is gone — replaced by the account-scoped `/orders/mine`, per the phase brief's migration instruction.
- `server/seed.js` — now also seeds one demo staff account (`staff@tooez.test` / `staff123`, printed to console on seed) so the dashboard is reachable without a manual signup step. Seeded sample orders are left unowned (`student_id` NULL) — they're demo data for the staff queue, not tied to any real student account.

**Frontend — files touched:**
- `web/src/lib/auth.js` — new: `getToken`/`getUser`/`setSession`/`clearSession`, thin localStorage wrapper (token + user JSON).
- `web/src/lib/student.js` — `getStudentName()` now reads from the auth session instead of its own separate localStorage key; `setStudentName` removed (identity now comes from signup/login, not a free-text name field). This let every existing display-only call site (`MenuScreen`, `CheckoutScreen`) keep working unchanged.
- `web/src/lib/api.js` — `request()` now attaches `Authorization: Bearer <token>` automatically when a session exists; added `signup`, `login`, `getMyOrders` (→ `/orders/mine`); `createOrder` no longer takes a student name (server derives it from the token); `getOrders(studentName)` removed.
- `web/src/lib/useActiveOrders.js`, `web/src/student/OrderStatusScreen.jsx` — gate on `getToken()` instead of a stored name; fetch via `api.getMyOrders()`.
- `web/src/student/CheckoutScreen.jsx` — `createOrder` call updated to the new signature (items only).
- `web/src/auth/AuthGate.jsx` — new, shared by both roles: a login/signup form gated by `role` prop (`student` | `staff`), themed to match each surface (light mobile theme vs. dark dashboard theme). Renders children once a session for that exact role exists.
- `web/src/student/NameGate.jsx` — deleted, superseded by `AuthGate`.
- `web/src/App.jsx` — student routes now wrapped in `<AuthGate role="student">` (was `NameGate`); `/dashboard` wrapped in a new `<AuthGate role="staff">`, so the dashboard is unreachable without a staff login — enforced both here (UI gate) and server-side (`requireAuth("staff")` on every dashboard-facing endpoint, so hitting the API directly doesn't bypass it either).
- `web/src/student/ProfileScreen.jsx` — "Switch student" (raw localStorage clear) replaced with "Log out" (`clearSession()`).
- `web/src/dashboard/DashboardScreen.jsx` — sidebar now shows the logged-in staff member's name and a "Log out" button.

**How to verify:**
```
cd server && npm install && npm run seed && npm start   # http://localhost:4000
cd web && npm install && npm run dev                     # http://localhost:5173 (student), /dashboard (staff)
```
Open `/`: sign up as a student (name/email/password) instead of the old name-only gate. Place a couple of orders — order history is now tied to that account, not the browser session (log out, log back in with the same email/password, orders are still there). Open `/dashboard`: blocked until you log in with the seeded staff account (`staff@tooez.test` / `staff123`, or sign up a new staff account); a student account cannot log into it.

Verified directly against the API (full transcript run this session): student signup → place 2 concurrent orders (fee-inclusive totals correct) → both independently listed via `/orders/mine` → staff login → sees all orders including the student's via `/orders` → advances one order's status → student's `/orders/mine` reflects the update on the advanced order only, the other order untouched. Security checks: no token on `/orders/mine` → 401; student token on staff-only `PATCH /:id/status` → 403; staff token on student-only `POST /orders` → 403; duplicate signup email → 409; wrong password → 401. `npm run build` passes clean (56 modules). No visual browser confirmation this session — browser extension wasn't connected (same as every prior phase); please click through signup → order → dashboard login once before relying on this.

**Not done (explicitly out of scope per the brief):** password reset, email verification, social login, any role/permission matrix beyond student vs. staff.

**Open questions:** none blocking.

**Next:** waiting on go-ahead for Phase 10 (fee placement).

## Phase 10 — Convenience fee placement (UI only)
**Status:** Done.

**Approach:** UI/copy only, per the phase brief — Phase 8's fee amount (₹10, server-computed) and `payableRupees` math are untouched.

**Files touched:**
- `web/src/student/CheckoutScreen.jsx` — removed the "Convenience fee — ₹10" line from the order-summary list (total line there is unchanged, still fee-inclusive). Added a small accent-bordered strip directly above the "Pay · ₹—" button with a ⚡ icon and the copy "Convenience fee for faster order processing", showing ₹10 beside it, using the existing `--mobile-accent`/`--mobile-hero` tokens.

**How to verify:**
```
cd server && npm start
cd web && npm run dev
```
Add items to cart → checkout: the order summary no longer lists the fee as a line item, but the total is still items+₹10. Directly above the Pay button is a small bordered strip with a lightning icon and "Convenience fee for faster order processing — ₹10".

`npm run build` passes clean (56 modules, unchanged module count — no new deps). No visual browser confirmation this session.

**Open questions:** none blocking.

**Next:** waiting on go-ahead for Phase 11 (manager role).

## Phase 11 — Manager role: income, basic analytics, menu control
**Status:** Done.

**Approach:** extended the existing `users.role` model (Phase 9) with a third value, `manager`, reusing the same JWT/`requireAuth(role)` middleware — no new auth mechanism. Analytics are computed on read directly from `orders`/`order_items` (no new tracking table). Income chart is a small dependency-free inline SVG bar chart (no charting library added), single series so no legend needed per the dataviz method — identity carried by the "Revenue by day" section title, accent-color bars, native `<title>` tooltip on hover.

**Backend — files touched:**
- `server/db.js` — `users.role` CHECK now allows `'manager'`. SQLite can't ALTER a CHECK constraint in place, so added a guarded migration that rebuils the `users` table (rename→recreate→copy→drop) only if an existing dev DB still has the old constraint; detected via `sqlite_master.sql` text rather than a version flag.
- `server/routes/auth.js` — signup/login now accept `role: "manager"` alongside student/staff.
- `server/routes/menu.js` — added manager-only routes: `GET /api/menu/all` (every item, including unavailable — the manager needs to see and re-enable hidden items, unlike the student-facing `GET /api/menu`), `POST /api/menu` (create custom item: name/price/category), `PATCH /api/menu/:id` (partial update — used for both availability toggle and edits), `DELETE /api/menu/:id`. All four gated with `requireAuth("manager")`.
- `server/routes/analytics.js` — new. `GET /api/analytics`, manager only: `totalOrders`, `totalRevenue`, `averageOrderValue`, `revenueByDay` (grouped by `date(created_at)`), `topItems` (top 5 by quantity sold, from `order_items`).
- `server/index.js` — registered the new analytics route.

**Frontend — files touched:**
- `web/src/lib/api.js` — added `getAllMenuItems`, `createMenuItem`, `updateMenuItem`, `deleteMenuItem`, `getAnalytics`; `request()` now short-circuits on a `204` response (menu delete returns no body).
- `web/src/auth/AuthGate.jsx` — added a `manager` theme entry (dark, matches the staff dashboard's look); fixed the password-field background check so it also applies dark styling for `manager` (was `staff`-only).
- `web/src/manager/IncomeChart.jsx` — new, the inline SVG bar chart described above.
- `web/src/manager/ManagerScreen.jsx` — new: sidebar shell (same pattern as `DashboardScreen`) + stat cards (orders/revenue/avg value) + income chart + top-items list + menu control panel (add-item form, per-item availability toggle pill, remove button).
- `web/src/App.jsx` — added `/manager` route, wrapped in `<AuthGate role="manager">`, alongside the existing `/dashboard` (staff) and student routes.

**How to verify:**
```
cd server && npm install && npm start   # http://localhost:4000
cd web && npm install && npm run dev    # http://localhost:5173/manager
```
Sign up a manager account at `/manager` (or log in with one you've created). You should see total orders / revenue / avg order value, a bar chart of revenue by day, top 5 items by quantity, and a menu list where you can toggle availability, remove items, or add a new one via the form. A student or staff account cannot reach `/manager` (UI-gated) or call its API routes (403 server-side, verified below).

Verified directly against the API this session: manager signup → `GET /api/analytics` (real numbers from the existing 7 seeded/test orders) → `GET /api/menu/all` → created a test item → toggled its availability off → deleted it (204) → confirmed a staff token gets 403 on `/api/analytics`. Also had to hand-repair the dev DB after the CHECK-constraint migration hit a `FOREIGN KEY constraint failed` on first run (SQLite's `ALTER TABLE ... RENAME` silently rewrites other tables' FK reference text to the new name, which broke `orders`'s reference during the `users` rebuild) — fixed by disabling `foreign_keys` around the migration and rebuilding `orders` once by hand to point back at `users`; no order data was lost (verified row count before/after). A fresh dev DB (no `tooez.db` yet) won't hit this — it's specific to migrating a DB that already existed before this phase. `npm run build` passes clean (58 modules, no new dependencies).

**Not done (explicitly out of scope per the brief):** demand forecasting, inventory automation, scheduled/recurring menu changes.

**Open questions:** none blocking.

**Next:** all 11 phases complete — nothing queued. Flag anything you want changed or added.
