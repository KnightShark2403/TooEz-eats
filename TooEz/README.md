# TooEz — AI Revenue Agents for Agentic Commerce

**Traditional payment systems tell merchants how much money they made.
TooEz asks what we can do *right now* to help them make more.**

TooEz is a multi-agent revenue system for merchants with time-sensitive inventory or
capacity. It detects revenue that is about to evaporate, prices an offer against it,
independently risk-checks that offer against the merchant's own guardrails, gets the
merchant's approval, executes the transaction through Razorpay, treats Razorpay's
webhook as the only source of payment truth, and feeds the realised outcome back into
the pricing model.

```
Detect  →  Decide  →  Risk-check  →  Approve  →  Transact  →  Learn
```

The demo environment is a campus cloud kitchen. The product is horizontal — the same
loop works for bakeries, salons, retail, restaurants and any SME whose inventory or
capacity expires.

Razorpay track: **AI Growth & Agentic Commerce**.

---

## Quick start

```bash
npm install
cp .env.example .env.local     # then paste your Razorpay TEST keys
npm run dev                    # http://localhost:3000/dashboard
```

**[SETUP.md](SETUP.md)** has the full Razorpay wiring — which credential goes where,
the exact webhook URL, which events to subscribe to, and a complete test transaction.
**[ARCHITECTURE.md](ARCHITECTURE.md)** has the data flow and the repository map.

With no keys at all the app still boots, on a clearly badged **mock gateway**, so the
agent pipeline can be developed offline. Add Razorpay test keys and the mock is
disabled outright.

Production build: `npm run build && npm start`.

| Surface | URL |
|---|---|
| Merchant dashboard | `/dashboard` |
| Customer food app | `/shop/<campaignId>` |
| Configuration health | `/api/health` |

### The 60-second demo

1. Open `/dashboard/agents`, press **Scan for opportunities**.
2. Click **Run agents** on *Chicken Wrap + Fries Combo* (₹755 recoverable).
3. Watch the Offer Agent propose **₹79** and the Risk Agent **VETO** it on four
   separate policy rules, then re-optimise to **₹109** and get approved.
4. Press **Approve campaign**, then **Open customer checkout**.
5. Pay in Razorpay's test Checkout. Revenue appears on the dashboard only after
   Razorpay itself confirms the capture — never on the browser's say-so.

`DEMO.md` has the full 2-minute choreography, `PITCH.md` the 4-minute script.

---

## The four agents

| Agent | Responsibility | How it decides |
|---|---|---|
| **Detection** | Find revenue about to be lost | Deterministic. 14 days of hourly demand history → forecast sell-through in the window → inventory at risk and revenue recoverable. No LLM touches these numbers. |
| **Offer / Pricing** | Maximise recoverable revenue | Optimises expected revenue over a price ladder using a demand curve that blends observed conversions from past campaigns with a logistic elasticity prior (Bayesian shrinkage). |
| **Risk** | Enforce merchant policy, independently | A deterministic rule engine with **its own data access**. Seven rules, each reporting observed-vs-limit. Can veto. |
| **Settlement** | Own the payment lifecycle | Razorpay order creation, checkout-signature verification, webhook processing, reconciliation, duplicate prevention, failure and retry. |

### Why the veto is real, not theatre

The Offer Agent **cannot read the `policies` table.** It is a revenue optimiser and,
left alone, it will happily propose a price that destroys margin — in the seeded demo
it proposes ₹79 on an item that costs ₹82 to make, because ₹79 genuinely maximises
expected revenue on the learned demand curve.

The Risk Agent is the only component with access to merchant policy. It also
**recomputes margin from `products.cogs_paise` itself** rather than trusting the
margin the Offer Agent reported. On the seeded data it fires four independent rules
against ₹79:

```
✕ Minimum gross margin      -3.8%            policy ≥ 22%
✕ Maximum discount depth     47.0%           policy ≤ 35%
✕ Daily discount budget      ₹2,610 of ₹2,500  policy ≤ ₹2,500/day
✕ Below-cost guard           ₹79             policy > ₹82 unit cost
```

It then returns **machine-readable constraints, never a price**:

```json
{ "minPricePaise": 10513, "maxExposurePaise": 87000, "excludePrices": [7900] }
```

The Offer Agent re-optimises inside that feasible set and lands on ₹109, which passes
all seven checks. The two agents never share a decision function — that is the whole
architectural point.

A veto is terminal for that price: **no campaign row is created**, and an order can
only ever be attached to a campaign. A vetoed price is structurally incapable of
reaching Razorpay.

The Risk Agent can also kill an opportunity outright. On the seeded *Paneer Kathi
Roll* it detects that the SKU is still clearing at full price and vetoes **any**
discount — the pipeline abandons with no campaign at all.

---

## Razorpay integration

Razorpay is not a payment button bolted on the end. It is the execution layer that
turns an agent decision into money, and its webhook is the system's source of truth.

The dashboard is not part of that path: it reads `/api/dashboard/*`, which reads the
database. It holds no Razorpay credential and makes no Razorpay call.

**What is implemented**

- Order creation with the official `razorpay` Node SDK (`orders.create`, amounts in paise).
- Razorpay Checkout on the customer page, with the key id served from the server.
- **Checkout signature verification** — `HMAC-SHA256(order_id|payment_id, key_secret)`.
- **Webhook signature verification** — `HMAC-SHA256(raw_body, webhook_secret)`, computed
  over the raw request text before any JSON parsing (parsing first breaks the HMAC).
- **Webhook as source of truth.** `/api/payments/confirm` — the endpoint the browser
  calls after Checkout succeeds — verifies the signature but can move an order no
  further than `AWAITING_CONFIRMATION`. Only `/api/webhooks/razorpay` and a
  server-side API reconcile can set `PAID`.
- **Idempotency at the database level**: `UNIQUE(campaign_id, idempotency_key)` on
  `orders` and a unique index on `razorpay_order_id`. A repeated create returns the
  existing Razorpay order instead of charging twice.
- **Webhook replay protection**: `webhook_events` is keyed by `x-razorpay-event-id`,
  so Razorpay's retries are no-ops.
- **Amount tamper check**: a captured amount that does not match the order is held for
  manual review rather than booked.
- **Failure handling**: `payment.failed` marks the order `FAILED` permanently; a retry
  creates a *new* order linked by `parent_order_id`, so a late webhook for the failed
  attempt can never resurrect it as revenue.
- **Immediate verification**: when Checkout returns, the server verifies the
  signature *and then asks Razorpay directly* (`orders.fetchPayments`) rather than
  leaving the customer waiting on an asynchronous webhook.
- **Refunds**: `payments.refund` through the backend, with `UNIQUE(payment_id,
  idempotency_key)`, a refunded-total guard, and `refund.processed` / `refund.failed`
  webhook handling that reverses revenue and restores stock.
- **Reconciliation**: `orders.fetchPayments(order_id)` as a second, equally valid
  source of truth when a webhook cannot reach you.

**Razorpay setup** — full walkthrough in [SETUP.md](SETUP.md). In short:

1. Razorpay Dashboard, **Test Mode**. *Account & Settings → API Keys → Generate Test Key.*
2. Put the pair in `.env.local` as `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`.
3. *Settings → Webhooks → Add New Webhook*, URL
   `https://<public-url>/api/webhooks/razorpay`, secret = a string you choose which
   you also put in `RAZORPAY_WEBHOOK_SECRET` (**not** the key secret — they are
   different secrets, and TooEz rejects them being equal).
4. Events: `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`,
   `refund.failed`.
5. `ngrok http 3000` to expose localhost, then restart `npm run dev`.

Test cards / VPAs: card `4111 1111 1111 1111`, any future expiry, any CVV, OTP `1111`;
UPI `success@razorpay` and `failure@razorpay`.

**No public URL at the venue?** Two fallbacks, both real:

- `node scripts/send-webhook.mjs <razorpay_order_id> captured 10900` — posts a
  correctly **HMAC-signed** payload to your local webhook endpoint. The app verifies it
  with exactly the same code that verifies Razorpay's own deliveries; this is not a bypass.
- The **Reconcile with Razorpay** button on the Payments tab calls
  `orders.fetchPayments()` against the live API and settles from the response.

---

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `RAZORPAY_KEY_ID` | for real payments | Test key id (`rzp_test_…`). **Public** — sent to the browser on the checkout page by design. |
| `RAZORPAY_KEY_SECRET` | for real payments | **Server only.** Authenticates API calls and verifies checkout signatures. Never reaches the browser or the logs. |
| `RAZORPAY_WEBHOOK_SECRET` | for webhooks | **Server only.** A *different* secret from the key secret; verifies inbound webhook HMACs. |
| `TOOEZ_MERCHANT_OWNER` | no | Name used in the dashboard greeting. |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | no | Enables LLM *narration only*. |
| `ANTHROPIC_MODEL` / `OPENAI_MODEL` | no | Model override. |
| `TOOEZ_DB_PATH` | no | SQLite file location. Default `./data/tooez.db`. |
| `TOOEZ_MERCHANT_ID` | no | Default `mrc_campuskitchen`. |

Nothing is hardcoded; every secret is read from the environment. `.env*` is gitignored.

### Where the LLM is — and is not

An LLM is optional and does exactly one thing: turn facts the deterministic code has
already computed into a readable sentence. It never computes a price, a margin, a
forecast or a risk verdict. With no key configured the app uses deterministic
sentences and behaves identically — every row records which was used
(`offers.reasoning_source`), and the dashboard shows an `LLM narration` chip when it
is on.

---

## Database

SQLite via `better-sqlite3` — real SQL, real transactions, real `UNIQUE` constraints
(which is what actually enforces idempotency), and zero setup for a demo machine. The
file is created and seeded automatically on first request.

- Schema: `src/lib/db/schema.sql` (13 tables, commented).
- Seed: `src/lib/db/seed.ts`.
- Reset: `npm run db:reset`, or the **Reset demo** button in the UI.

All money is stored as integer **paise**. Rupee floats never touch the database, and
Razorpay's API speaks paise too, so there is exactly one conversion point: display.

**Porting to Postgres/Supabase**: `schema.sql` is close to portable DDL (drop the
`PRAGMA`s, `AUTOINCREMENT` → `GENERATED … AS IDENTITY`, `datetime('now')` → `now()`).
All query code lives in `src/lib/db/`, `src/lib/state.ts` and the agent modules.

---

## Project layout

```
src/
  agents/
    detection.ts       Detection Agent — deterministic forecasting
    pricing-model.ts   Elasticity prior + Bayesian blend with observed outcomes
    offer.ts           Offer Agent — revenue optimiser (no policy access)
    risk.ts            Risk Agent — 7-rule policy engine, veto + remediation
    settlement.ts      Settlement Agent — payment lifecycle, webhooks, idempotency
    orchestrator.ts    Offer ⇄ Risk negotiation loop, approval gate
  lib/
    db/                schema.sql, connection, seed
    razorpay.ts        SDK adapter, signature verification, mock adapter
    llm.ts             Optional narration (never numbers)
    audit.ts           Append-only audit trail
    events.ts          In-process bus → SSE
    state.ts           Dashboard read model
  app/
    page.tsx           Merchant dashboard
    shop/[id]/         Customer checkout
    api/…              Routes (scan, pipeline, campaigns, orders, payments, webhooks, stream)
  components/          UI
scripts/
  test-pipeline.mjs    Full end-to-end test (33 assertions)
  send-webhook.mjs     Signed webhook sender
  reset-db.mjs         Wipe the demo database
legacy/                The repo's previous, unrelated project — untouched
```

---

## Tests

```bash
npm run dev             # terminal 1

npm run test:pipeline   # agent pipeline + webhook contract (33 assertions)
npm run test:razorpay   # REAL Razorpay test-mode integration (35 assertions)
npm test                # both
npm run test:checkout   # full browser run through the real Razorpay Checkout
```

`test:pipeline` covers detection → veto → revision → approval → order → idempotency →
the frontend's inability to mark an order paid → webhook capture → replay protection →
failure → retry → learning-loop update → audit completeness.

`test:razorpay` creates a real order through the app and then **independently fetches
it from Razorpay**, asserting that the amount, receipt and `notes.tooez_order_id` all
match — proving the mapping in both directions. It also covers forged signatures,
unknown orders, duplicate deliveries, amount tampering, failed payments, refunds, and
the absence of any secret in a dashboard payload.

---

## Honest scope: what is real and what is simulated

**Real**
- All four agents, their data access boundaries, and the veto.
- The Razorpay SDK integration, both signature verifications, the webhook receiver,
  reconciliation, and every idempotency and replay guard.
- SQLite persistence, the audit trail, and the learning loop.
- The merchant approval gate.

**Simulated, and labelled as such in the product**
- **Merchant data.** The demand history, inventory, unit costs and prior campaign
  outcomes are seeded (`src/lib/db/seed.ts`). A real deployment reads these from the
  merchant's POS. The agents do not know the difference.
- **The mock gateway.** Active only when no Razorpay keys are configured. It generates
  `mock_order_…` ids, renders a `MOCK GATEWAY` badge in the UI, stamps `gateway='mock'`
  on the order row, and refuses to run at all once real keys are present. It still
  routes through the real `processWebhook()` code path, so the browser never marks
  anything paid even in mock mode.
- **LLM narration**, when enabled, phrases reasoning. It never produces a number.

**Not implemented**
- Razorpay Route / split settlement, Payment Links, and Razorpay's fraud signals
  (P2 items — a fully working payment + webhook + refund path was the higher priority).
- Authentication. One seeded merchant, no login — so there is no session to protect
  yet. Add auth before exposing this beyond a demo.
- Editing the menu from the dashboard. Products, stock and unit costs come from the
  seeded merchant record; production would sync them from a POS.
