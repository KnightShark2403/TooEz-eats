-- TooEz schema. All money is stored in PAISE (integer). Never use floats for money.
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS merchants (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  owner_name    TEXT,
  vertical      TEXT NOT NULL,
  timezone      TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Merchant-configurable guardrails. The Risk Agent reads ONLY from here.
CREATE TABLE IF NOT EXISTS policies (
  merchant_id                 TEXT PRIMARY KEY REFERENCES merchants(id) ON DELETE CASCADE,
  min_margin_pct              REAL    NOT NULL,  -- e.g. 22.0 => offer price must retain >=22% gross margin
  max_discount_pct            REAL    NOT NULL,  -- e.g. 35.0 => never discount more than 35% off list
  daily_discount_budget_paise INTEGER NOT NULL,  -- total subsidy (list-offer)*units allowed per day
  max_campaign_exposure_paise INTEGER NOT NULL,  -- max subsidy a single campaign may risk
  max_active_campaigns        INTEGER NOT NULL,
  cannibalization_window_min  INTEGER NOT NULL,  -- don't discount a SKU sold at full price within N minutes
  require_merchant_approval   INTEGER NOT NULL DEFAULT 1,
  updated_at                  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id             TEXT PRIMARY KEY,
  merchant_id    TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  sku            TEXT NOT NULL,
  name           TEXT NOT NULL,
  category       TEXT NOT NULL,
  list_price_paise INTEGER NOT NULL,
  cogs_paise     INTEGER NOT NULL,          -- true unit cost, used for margin math
  perishable     INTEGER NOT NULL DEFAULT 1,
  shelf_life_min INTEGER NOT NULL DEFAULT 240,
  stock_units    INTEGER NOT NULL DEFAULT 0,
  produced_at    TEXT,
  UNIQUE (merchant_id, sku)
);

-- Hourly historical sell-through, used by the Detection Agent's deterministic forecast.
CREATE TABLE IF NOT EXISTS demand_history (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id   TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  day_offset   INTEGER NOT NULL,   -- 1 = yesterday, 7 = a week ago
  hour_of_day  INTEGER NOT NULL,   -- 0..23
  units_sold   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_demand_product_hour ON demand_history(product_id, hour_of_day);

CREATE TABLE IF NOT EXISTS opportunities (
  id                 TEXT PRIMARY KEY,
  merchant_id        TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  product_id         TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  detected_at        TEXT NOT NULL DEFAULT (datetime('now')),
  window_minutes     INTEGER NOT NULL,
  stock_units        INTEGER NOT NULL,
  baseline_units     REAL NOT NULL,     -- units expected to sell in window at list price
  expected_waste     REAL NOT NULL,     -- units forecast to go unsold / expire
  sell_through_pct   REAL NOT NULL,
  demand_trend       TEXT NOT NULL,     -- FALLING | FLAT | RISING
  demand_index       REAL NOT NULL,     -- current hour demand vs daily peak (0..1)
  value_at_risk_paise INTEGER NOT NULL, -- the headline "opportunity" number
  status             TEXT NOT NULL DEFAULT 'OPEN', -- OPEN | PROCESSED | EXPIRED | DISMISSED
  rationale          TEXT NOT NULL,
  signals_json       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_opp_status ON opportunities(merchant_id, status);

-- Every price the Offer Agent proposes, including ones that got vetoed.
CREATE TABLE IF NOT EXISTS offers (
  id                    TEXT PRIMARY KEY,
  opportunity_id        TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  attempt               INTEGER NOT NULL,
  offer_price_paise     INTEGER NOT NULL,
  bundle_label          TEXT NOT NULL,
  discount_pct          REAL NOT NULL,
  expected_conversions  REAL NOT NULL,
  expected_revenue_paise INTEGER NOT NULL,
  expected_margin_paise INTEGER NOT NULL,
  margin_pct            REAL NOT NULL,
  units_offered         INTEGER NOT NULL,
  strategy              TEXT NOT NULL,   -- LEARNED | EXPLORE | CONSTRAINT_REPAIR
  reasoning             TEXT NOT NULL,
  reasoning_source      TEXT NOT NULL DEFAULT 'deterministic', -- deterministic | llm
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (opportunity_id, attempt)
);

-- Independent Risk Agent verdicts. One row per offer evaluated.
CREATE TABLE IF NOT EXISTS risk_decisions (
  id              TEXT PRIMARY KEY,
  offer_id        TEXT NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  opportunity_id  TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  verdict         TEXT NOT NULL,       -- APPROVED | VETOED
  checks_json     TEXT NOT NULL,       -- full per-rule evaluation, pass/fail + observed vs limit
  violated_rules  TEXT NOT NULL DEFAULT '',
  primary_reason  TEXT NOT NULL,
  remediation_json TEXT,               -- machine-readable constraints handed back to the Offer Agent
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (offer_id)
);

CREATE TABLE IF NOT EXISTS campaigns (
  id                  TEXT PRIMARY KEY,
  merchant_id         TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  opportunity_id      TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  offer_id            TEXT NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  product_id          TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  status              TEXT NOT NULL,   -- PENDING_APPROVAL | LIVE | REJECTED | COMPLETED | EXPIRED
  price_paise         INTEGER NOT NULL,
  units_offered       INTEGER NOT NULL,
  units_sold          INTEGER NOT NULL DEFAULT 0,
  impressions         INTEGER NOT NULL DEFAULT 0,
  revenue_paise       INTEGER NOT NULL DEFAULT 0,
  discount_cost_paise INTEGER NOT NULL DEFAULT 0,
  expires_at          TEXT NOT NULL,
  approved_by         TEXT,
  approved_at         TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_campaign_status ON campaigns(merchant_id, status);

-- Orders. The (campaign_id, idempotency_key) UNIQUE index is what actually
-- prevents duplicate Razorpay orders under double-clicks / retries.
CREATE TABLE IF NOT EXISTS orders (
  id                 TEXT PRIMARY KEY,
  campaign_id        TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  merchant_id        TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  idempotency_key    TEXT NOT NULL,
  razorpay_order_id  TEXT,
  amount_paise       INTEGER NOT NULL,
  currency           TEXT NOT NULL DEFAULT 'INR',
  status             TEXT NOT NULL,   -- CREATED | AWAITING_CONFIRMATION | PAID | FAILED | ABANDONED
  gateway            TEXT NOT NULL,   -- razorpay | mock
  customer_ref       TEXT,
  customer_name      TEXT,
  customer_phone     TEXT,
  payment_method     TEXT,     -- upi | card | netbanking | wallet — from Razorpay
  captured_at        TEXT,     -- when Razorpay confirmed capture
  failure_reason     TEXT,
  failure_code       TEXT,
  attempt_no         INTEGER NOT NULL DEFAULT 1,
  parent_order_id    TEXT,            -- set when this order is a retry of a failed one
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (campaign_id, idempotency_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_rzp ON orders(razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS payments (
  id                  TEXT PRIMARY KEY,          -- razorpay payment id (pay_xxx) or mock id
  order_id            TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  razorpay_order_id   TEXT,
  amount_paise        INTEGER NOT NULL,
  status              TEXT NOT NULL,             -- captured | failed | authorized
  method              TEXT,
  error_code          TEXT,
  error_description   TEXT,
  confirmed_source    TEXT NOT NULL,             -- webhook | api_reconcile  (never 'frontend')
  raw_json            TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Webhook dedupe. Razorpay retries; the UNIQUE id makes replays no-ops.
CREATE TABLE IF NOT EXISTS webhook_events (
  id           TEXT PRIMARY KEY,   -- x-razorpay-event-id header, else hash of the body
  event        TEXT NOT NULL,
  signature_ok INTEGER NOT NULL,
  payload      TEXT NOT NULL,
  processed_at TEXT NOT NULL DEFAULT (datetime('now')),
  result       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id TEXT NOT NULL,
  ts          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  actor       TEXT NOT NULL,   -- DETECTION_AGENT | OFFER_AGENT | RISK_AGENT | SETTLEMENT_AGENT | MERCHANT | RAZORPAY | SYSTEM
  action      TEXT NOT NULL,
  severity    TEXT NOT NULL DEFAULT 'info', -- info | success | warn | veto | error
  summary     TEXT NOT NULL,
  detail_json TEXT,
  opportunity_id TEXT,
  campaign_id TEXT,
  order_id    TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(merchant_id, id DESC);

-- The learning loop. One row per (product, price point) with realised outcomes.
CREATE TABLE IF NOT EXISTS offer_outcomes (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id       TEXT NOT NULL,
  product_id        TEXT NOT NULL,
  price_paise       INTEGER NOT NULL,
  discount_bucket   INTEGER NOT NULL,  -- discount % rounded to nearest 5
  impressions       INTEGER NOT NULL DEFAULT 0,
  conversions       INTEGER NOT NULL DEFAULT 0,
  revenue_paise     INTEGER NOT NULL DEFAULT 0,
  discount_cost_paise INTEGER NOT NULL DEFAULT 0,
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (merchant_id, product_id, price_paise)
);

-- Organic full-price sales. Drives today's baseline revenue and the
-- Risk Agent's cannibalization check ("is this SKU still selling at list?").
CREATE TABLE IF NOT EXISTS organic_sales (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id      TEXT NOT NULL,
  product_id       TEXT NOT NULL,
  units            INTEGER NOT NULL,
  unit_price_paise INTEGER NOT NULL,
  sold_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_organic_product ON organic_sales(product_id, sold_at);

-- Refunds. A privileged Razorpay operation: only the backend holds the key
-- secret, so the dashboard requests a refund and the server performs it.
CREATE TABLE IF NOT EXISTS refunds (
  id                 TEXT PRIMARY KEY,          -- razorpay refund id (rfnd_…) or local id before confirmation
  order_id           TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_id         TEXT NOT NULL,
  merchant_id        TEXT NOT NULL,
  amount_paise       INTEGER NOT NULL,
  status             TEXT NOT NULL,             -- pending | processed | failed
  speed              TEXT,
  reason             TEXT,
  idempotency_key    TEXT NOT NULL,
  confirmed_source   TEXT,                      -- webhook | api
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (payment_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id);
