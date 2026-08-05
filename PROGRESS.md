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
