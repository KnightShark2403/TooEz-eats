# TooEz — architecture

## The one-paragraph version

There is **one** application and **one** backend. Next.js serves both the customer
food app and the merchant dashboard, and its route handlers *are* the TooEz backend.
The food app never talks to Razorpay directly beyond opening Checkout with the public
key id; the dashboard never talks to Razorpay at all. Every privileged Razorpay
operation happens server-side, and everything the dashboard renders comes out of
TooEz's own database.

```
FOOD APP  (/shop/[campaignId])
    │  POST /api/orders/create          { campaignId, idempotencyKey, name, phone }
    ▼
TOOEZ BACKEND  (Next.js route handlers — the only holder of the key secret)
    │
    ├──► Razorpay API      orders.create · orders.fetchPayments · payments.refund
    │                      (RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET)
    │
    ├──◄ Webhook           POST /api/webhooks/razorpay
    │                      HMAC-SHA256 over the RAW body, RAZORPAY_WEBHOOK_SECRET
    │
    ▼
DATABASE  (SQLite — orders, payments, refunds, webhook_events, campaigns, audit_log)
    │
    ▼
PROFESSIONAL DASHBOARD  (/dashboard/*)
    reads /api/dashboard/* only — no Razorpay credentials, ever
```

## Where each credential lives

| Credential | Stored in | Read by | Ever reaches the browser? |
|---|---|---|---|
| `RAZORPAY_KEY_ID` | `.env.local` | `src/lib/env.ts` → `publicGatewayInfo()` | **Yes, deliberately.** Razorpay Checkout needs it, and it is a public identifier. Served only to `/shop/[campaignId]`. |
| `RAZORPAY_KEY_SECRET` | `.env.local` | `src/lib/razorpay.ts` only | **No.** Never serialised into any API response, never logged (the logger redacts it by value). |
| `RAZORPAY_WEBHOOK_SECRET` | `.env.local` | `src/lib/razorpay.ts` `verifyWebhookSignature()` only | **No.** Same protections. |

Verified mechanically: `npm run test:razorpay` asserts that neither secret appears in
any dashboard payload, and no `'use client'` file in the repo references `process.env`.

## Request flows

### Creating an order (food app → backend → Razorpay)

1. `POST /api/orders/create` with a client-generated `idempotencyKey`.
2. `createOrderForCampaign()` refuses unless the campaign is `LIVE` — which requires
   an approved Risk Agent verdict *and* merchant sign-off.
3. `INSERT INTO orders` with `UNIQUE(campaign_id, idempotency_key)`. A repeat request
   returns the existing row and its existing Razorpay order — the database prevents
   the double charge, not an `if` statement.
4. `razorpay.orders.create({ amount, receipt: <tooez order id>, notes: { tooez_order_id } })`.
   The receipt *and* the notes carry the TooEz id, so the mapping is recoverable from
   Razorpay's side too.
5. The Razorpay order id is written back, with a unique index on it.

### Confirming a payment (two authoritative paths, one state machine)

**Immediate** — the customer is waiting:
`POST /api/payments/confirm` verifies `HMAC(order_id|payment_id, key_secret)`, sets
`AWAITING_CONFIRMATION`, then calls `orders.fetchPayments()` **server-side**. If
Razorpay says captured, the order settles right there.

**Asynchronous** — the safety net:
`POST /api/webhooks/razorpay` reads the **raw** body text before any parsing (parsing
first would break the HMAC), verifies `HMAC(raw_body, webhook_secret)`, and settles.

Both call the same `processWebhook()`. Neither trusts the browser: the endpoint the
browser calls cannot, on its own, move an order past `AWAITING_CONFIRMATION`.

### Idempotency and safety

| Risk | Mechanism |
|---|---|
| Duplicate order / double charge | `UNIQUE(campaign_id, idempotency_key)` + unique index on `razorpay_order_id` |
| Replayed webhook | `webhook_events` primary key = `x-razorpay-event-id` |
| Forged webhook | HMAC verification; rejected with 400 and nothing written |
| Amount tampering | Captured amount compared to the stored order amount; mismatch is held for review |
| Late webhook for a failed order | `FAILED` is terminal; retries create a **new** order linked by `parent_order_id` |
| Double refund | `UNIQUE(payment_id, idempotency_key)` on `refunds`, plus a refunded-total check |
| Model taking a financial action | The Offer Agent cannot read the policy table; the Risk Agent can veto; a vetoed price never produces a campaign, and orders attach only to campaigns |

## Repository map

```
src/
  app/
    page.tsx                    → redirects to /dashboard
    shop/[campaignId]/          FOOD APP — customer checkout, Razorpay Checkout
    dashboard/
      layout.tsx                shell: Sidebar + Topbar + theme
      page.tsx                  Overview
      orders/  payments/  customers/  analytics/
      agents/                   AI Assistant — the revenue agents
      products/  campaigns/  settings/
    api/
      dashboard/{overview,revenue,orders,orders/[id],payments,customers,products,analytics,campaigns}
                                DASHBOARD READ MODEL — the only data source for /dashboard
      orders/{create,retry,reconcile,refund}     order + refund lifecycle
      payments/confirm          checkout return: verify signature, then verify with Razorpay
      webhooks/razorpay         webhook receiver (raw body, HMAC)
      scan · pipeline/run · campaigns/[id]/{approve,reject} · policies · state · stream
      health                    configuration self-check (names, never values)
      dev/{reset,mock-payment}  development only; mock refuses to run when keys exist
  agents/
    detection.ts                deterministic forecasting
    pricing-model.ts            elasticity prior blended with observed outcomes
    offer.ts                    revenue optimiser — NO access to policies
    risk.ts                     7-rule policy engine — veto + machine-readable remediation
    settlement.ts               payment + refund lifecycle, webhooks, idempotency
    orchestrator.ts             Offer ⇄ Risk negotiation, merchant approval gate
  lib/
    env.ts        credential validation and the browser-safe gateway view
    logger.ts     structured logs with mandatory secret redaction
    razorpay.ts   SDK adapter, signature verification, refunds, mock adapter
    dashboard.ts  dashboard read model (all SQL for /api/dashboard/*)
    db/           schema.sql · connection · seed
    llm.ts        optional narration — never a number
    audit.ts · events.ts · money.ts · ids.ts · state.ts · merchant.ts
  components/
    theme.tsx                   two-theme provider, persisted per device
    ui/{icons,kit,charts,data}  design system: icons, primitives, SVG charts, hooks
    shell/{Sidebar,Topbar}      app chrome
    agents/{OpportunityCard,DecisionConsole,AuditLog}
    OrderDrawer.tsx             order detail + refund
legacy/                         the repo's previous, unrelated project — untouched
scripts/                        test-pipeline · test-razorpay · test-checkout · send-webhook · reset-db
```

## Design system

Two complete themes over one set of CSS custom properties in `globals.css`:

- **Light** — indigo (`#4338ca`) on warm off-white, with beige (`#b99a6b`) as the
  secondary accent.
- **Dark** — midnight navy (`#0a0e1a`, never pure black), soft indigo, beige accent,
  emerald for success.

Both share every route, component, chart and query; only the token values change.
Glass (`.glass`) is used on the sidebar, topbar and KPI cards only, degrades to a
solid surface where `backdrop-filter` is unsupported, and the layout is legible with
it disabled. Charts are hand-drawn SVG reading the same tokens — no charting
dependency, and one accent series plus a muted comparison rather than a rainbow.

## Money

All money is integer **paise**, everywhere, including in the database. Razorpay's API
also speaks paise, so there is exactly one conversion point: display. Floats never
touch a monetary value.
