import { getDb } from './db';
import { publicGatewayInfo } from './env';
import { getPolicies, discountSpentToday, activeCampaignCount } from '@/agents/risk';

/**
 * Dashboard read model.
 *
 * Every figure here is computed from TooEz's own database — orders, payments,
 * refunds, campaigns and organic sales. The dashboard never talks to Razorpay:
 * Razorpay data reaches the database only through the Settlement Agent (order
 * creation, signature-verified webhooks, and server-side API reconciliation).
 *
 * Nothing in this file invents a number. When there is no data, the endpoint
 * returns zeroes and an `empty: true` marker so the UI can render an honest
 * empty state instead of a fake one.
 */

const DAY = "date(?, 'localtime')";

export type Range = '7d' | '30d' | '90d' | 'today';

function rangeDays(range: Range): number {
  return range === 'today' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : 90;
}

function sinceClause(range: Range): string {
  return range === 'today' ? "datetime('now','localtime','start of day')"
    : `datetime('now','localtime','-${rangeDays(range) - 1} days','start of day')`;
}

// ---------------------------------------------------------------------------
// Overview / KPIs
// ---------------------------------------------------------------------------

export function overview(merchantId: string, range: Range = '7d') {
  const db = getDb();
  const since = sinceClause(range);
  const prevSince = `datetime(${since}, '-${rangeDays(range)} days')`;

  const paymentAgg = (from: string, to: string) => db.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN o.status IN ('PAID','PARTIALLY_REFUNDED') THEN o.amount_paise ELSE 0 END),0) AS gross,
       SUM(CASE WHEN o.status IN ('PAID','PARTIALLY_REFUNDED','REFUNDED') THEN 1 ELSE 0 END) AS succeeded,
       SUM(CASE WHEN o.status = 'FAILED' THEN 1 ELSE 0 END) AS failed,
       COUNT(*) AS attempted
     FROM orders o
     WHERE o.merchant_id = ? AND o.created_at >= ${from} AND o.created_at < ${to}`
  ).get(merchantId) as { gross: number; succeeded: number; failed: number; attempted: number };

  const cur = paymentAgg(since, "datetime('now','localtime','+1 day')");
  const prev = paymentAgg(prevSince, since);

  const refunded = (db.prepare(
    `SELECT COALESCE(SUM(amount_paise),0) AS a FROM refunds
      WHERE merchant_id = ? AND status = 'processed' AND created_at >= ${since}`
  ).get(merchantId) as { a: number }).a;

  // Organic (non-agent) counter sales, so "revenue" reflects the whole business.
  const organic = (db.prepare(
    `SELECT COALESCE(SUM(units * unit_price_paise),0) AS r FROM organic_sales
      WHERE merchant_id = ? AND sold_at >= ${since}`
  ).get(merchantId) as { r: number }).r;
  const organicPrev = (db.prepare(
    `SELECT COALESCE(SUM(units * unit_price_paise),0) AS r FROM organic_sales
      WHERE merchant_id = ? AND sold_at >= ${prevSince} AND sold_at < ${since}`
  ).get(merchantId) as { r: number }).r;

  const successRate = cur.attempted ? (cur.succeeded / cur.attempted) * 100 : 0;
  const prevSuccessRate = prev.attempted ? (prev.succeeded / prev.attempted) * 100 : 0;

  const policies = getPolicies(merchantId);

  return {
    range,
    gateway: publicGatewayInfo(),
    kpis: {
      revenue: {
        value: cur.gross - refunded + organic,
        agentRevenue: cur.gross - refunded,
        organicRevenue: organic,
        refunded,
        previous: prev.gross + organicPrev,
        deltaPct: pctDelta(cur.gross - refunded + organic, prev.gross + organicPrev),
      },
      orders: {
        value: cur.attempted,
        previous: prev.attempted,
        deltaPct: pctDelta(cur.attempted, prev.attempted),
      },
      successfulPayments: {
        value: cur.succeeded,
        rate: successRate,
        previous: prev.succeeded,
        deltaPct: pctDelta(cur.succeeded, prev.succeeded),
      },
      failedPayments: {
        value: cur.failed,
        rate: cur.attempted ? (cur.failed / cur.attempted) * 100 : 0,
        previous: prev.failed,
        deltaPct: pctDelta(cur.failed, prev.failed),
      },
      successRateDeltaPts: successRate - prevSuccessRate,
    },
    guardrails: {
      discountSpentPaise: discountSpentToday(merchantId),
      discountBudgetPaise: policies.daily_discount_budget_paise,
      activeCampaigns: activeCampaignCount(merchantId),
      maxActiveCampaigns: policies.max_active_campaigns,
    },
    empty: cur.attempted === 0 && organic === 0,
  };
}

function pctDelta(now: number, before: number): number | null {
  if (!before) return now ? null : 0;   // null = "no comparable prior period"
  return ((now - before) / before) * 100;
}

// ---------------------------------------------------------------------------
// Revenue series
// ---------------------------------------------------------------------------

export function revenueSeries(merchantId: string, range: Range = '7d') {
  const db = getDb();
  const days = rangeDays(range);
  const rows = db.prepare(
    `WITH RECURSIVE d(day) AS (
        SELECT date('now','localtime','-${days - 1} days')
        UNION ALL SELECT date(day, '+1 day') FROM d WHERE day < date('now','localtime')
     )
     SELECT d.day AS day,
       (SELECT COALESCE(SUM(o.amount_paise),0) FROM orders o
         WHERE o.merchant_id = @m AND o.status IN ('PAID','PARTIALLY_REFUNDED')
           AND date(o.captured_at, 'localtime') = d.day) AS agent_paise,
       (SELECT COALESCE(SUM(s.units * s.unit_price_paise),0) FROM organic_sales s
         WHERE s.merchant_id = @m AND date(s.sold_at, 'localtime') = d.day) AS organic_paise,
       (SELECT COUNT(*) FROM orders o2
         WHERE o2.merchant_id = @m AND date(o2.created_at, 'localtime') = d.day) AS orders
     FROM d`
  ).all({ m: merchantId }) as { day: string; agent_paise: number; organic_paise: number; orders: number }[];

  return rows.map((r) => ({
    day: r.day,
    revenuePaise: r.agent_paise + r.organic_paise,
    agentPaise: r.agent_paise,
    organicPaise: r.organic_paise,
    orders: r.orders,
  }));
}

// ---------------------------------------------------------------------------
// Orders / payments
// ---------------------------------------------------------------------------

export interface OrderQuery {
  status?: string; search?: string; limit?: number; offset?: number; range?: Range;
}

export function orders(merchantId: string, q: OrderQuery = {}) {
  const db = getDb();
  const limit = Math.min(Math.max(q.limit ?? 25, 1), 200);
  const offset = Math.max(q.offset ?? 0, 0);

  const where: string[] = ['o.merchant_id = @m'];
  const params: Record<string, unknown> = { m: merchantId, limit, offset };

  if (q.status && q.status !== 'ALL') { where.push('o.status = @status'); params.status = q.status; }
  if (q.range) where.push(`o.created_at >= ${sinceClause(q.range)}`);
  if (q.search) {
    where.push(`(o.id LIKE @q OR o.razorpay_order_id LIKE @q OR IFNULL(o.customer_name,'') LIKE @q
                 OR IFNULL(o.customer_phone,'') LIKE @q OR p.name LIKE @q)`);
    params.q = `%${q.search}%`;
  }
  const w = where.join(' AND ');

  const base = `FROM orders o
      JOIN campaigns c ON c.id = o.campaign_id
      JOIN products  p ON p.id = c.product_id
     WHERE ${w}`;

  const rows = db.prepare(
    `SELECT o.id, o.status, o.amount_paise, o.currency, o.gateway, o.razorpay_order_id,
            o.customer_name, o.customer_phone, o.customer_ref, o.payment_method,
            o.created_at, o.captured_at, o.updated_at, o.failure_reason, o.failure_code,
            o.attempt_no, o.parent_order_id,
            p.name AS product_name, p.id AS product_id, c.id AS campaign_id, c.price_paise,
            (SELECT id FROM payments pay WHERE pay.order_id = o.id ORDER BY created_at DESC LIMIT 1) AS razorpay_payment_id,
            (SELECT COALESCE(SUM(amount_paise),0) FROM refunds r WHERE r.order_id = o.id AND r.status='processed') AS refunded_paise
     ${base}
     ORDER BY o.created_at DESC LIMIT @limit OFFSET @offset`
  ).all(params) as any[];

  const total = (db.prepare(`SELECT COUNT(*) AS n ${base}`).get(params) as { n: number }).n;

  return { rows, total, limit, offset, hasMore: offset + rows.length < total };
}

export function orderDetail(merchantId: string, orderId: string) {
  const db = getDb();
  const order = db.prepare(
    `SELECT o.*, p.name AS product_name, p.list_price_paise, c.price_paise AS campaign_price, c.id AS campaign_id
       FROM orders o JOIN campaigns c ON c.id = o.campaign_id JOIN products p ON p.id = c.product_id
      WHERE o.id = ? AND o.merchant_id = ?`
  ).get(orderId, merchantId) as any;
  if (!order) return null;
  return {
    order,
    payments: db.prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC').all(orderId),
    refunds: db.prepare('SELECT * FROM refunds WHERE order_id = ? ORDER BY created_at DESC').all(orderId),
    timeline: db.prepare('SELECT * FROM audit_log WHERE order_id = ? ORDER BY id ASC').all(orderId),
  };
}

export function payments(merchantId: string, q: { status?: string; search?: string; limit?: number; offset?: number } = {}) {
  const db = getDb();
  const limit = Math.min(Math.max(q.limit ?? 25, 1), 200);
  const offset = Math.max(q.offset ?? 0, 0);
  const where: string[] = ['o.merchant_id = @m'];
  const params: Record<string, unknown> = { m: merchantId, limit, offset };
  if (q.status && q.status !== 'ALL') { where.push('pay.status = @status'); params.status = q.status; }
  if (q.search) {
    where.push(`(pay.id LIKE @q OR pay.razorpay_order_id LIKE @q OR o.id LIKE @q OR IFNULL(o.customer_name,'') LIKE @q)`);
    params.q = `%${q.search}%`;
  }
  const base = `FROM payments pay
      JOIN orders o ON o.id = pay.order_id
      JOIN campaigns c ON c.id = o.campaign_id
      JOIN products p ON p.id = c.product_id
     WHERE ${where.join(' AND ')}`;

  const rows = db.prepare(
    `SELECT pay.id AS razorpay_payment_id, pay.razorpay_order_id, pay.amount_paise, pay.status,
            pay.method, pay.error_code, pay.error_description, pay.confirmed_source, pay.created_at,
            o.id AS tooez_order_id, o.customer_name, o.customer_phone, o.gateway,
            p.name AS product_name,
            (SELECT COALESCE(SUM(amount_paise),0) FROM refunds r WHERE r.payment_id = pay.id AND r.status='processed') AS refunded_paise
     ${base} ORDER BY pay.created_at DESC LIMIT @limit OFFSET @offset`
  ).all(params) as any[];

  const total = (db.prepare(`SELECT COUNT(*) AS n ${base}`).get(params) as { n: number }).n;
  const methods = db.prepare(
    `SELECT COALESCE(pay.method,'unknown') AS method, COUNT(*) AS n, COALESCE(SUM(pay.amount_paise),0) AS amount
       FROM payments pay JOIN orders o ON o.id = pay.order_id
      WHERE o.merchant_id = ? AND pay.status = 'captured'
      GROUP BY 1 ORDER BY n DESC`
  ).all(merchantId) as any[];

  return { rows, total, limit, offset, hasMore: offset + rows.length < total, methods };
}

// ---------------------------------------------------------------------------
// Customers — derived from orders. No separate customer table exists, so this
// is an aggregation, not an invented entity.
// ---------------------------------------------------------------------------

export function customers(merchantId: string, q: { search?: string; limit?: number } = {}) {
  const db = getDb();
  const limit = Math.min(Math.max(q.limit ?? 50, 1), 200);
  const rows = db.prepare(
    `SELECT
        COALESCE(NULLIF(o.customer_phone,''), NULLIF(o.customer_name,''), o.customer_ref, 'guest') AS customer_key,
        MAX(o.customer_name)  AS name,
        MAX(o.customer_phone) AS phone,
        COUNT(*)              AS orders,
        SUM(CASE WHEN o.status IN ('PAID','PARTIALLY_REFUNDED','REFUNDED') THEN 1 ELSE 0 END) AS paid_orders,
        COALESCE(SUM(CASE WHEN o.status IN ('PAID','PARTIALLY_REFUNDED') THEN o.amount_paise ELSE 0 END),0) AS spend_paise,
        MIN(o.created_at)     AS first_order_at,
        MAX(o.created_at)     AS last_order_at
      FROM orders o
     WHERE o.merchant_id = ?
     GROUP BY customer_key
     ORDER BY spend_paise DESC, orders DESC
     LIMIT ?`
  ).all(merchantId, limit) as any[];

  const filtered = q.search
    ? rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q.search!.toLowerCase()))
    : rows;

  return {
    rows: filtered.map((r) => ({
      ...r,
      avg_order_paise: r.paid_orders ? Math.round(r.spend_paise / r.paid_orders) : 0,
      returning: r.orders > 1,
    })),
    total: filtered.length,
    note: 'Derived by aggregating orders. TooEz has no separate customer record; name and phone are what the customer entered at checkout.',
  };
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export function products(merchantId: string) {
  const db = getDb();
  const rows = db.prepare(
    `SELECT p.*,
        (SELECT COALESCE(SUM(o.amount_paise),0) FROM orders o JOIN campaigns c ON c.id = o.campaign_id
          WHERE c.product_id = p.id AND o.status IN ('PAID','PARTIALLY_REFUNDED')) AS agent_revenue_paise,
        (SELECT COUNT(*) FROM orders o JOIN campaigns c ON c.id = o.campaign_id
          WHERE c.product_id = p.id AND o.status IN ('PAID','PARTIALLY_REFUNDED')) AS agent_units,
        (SELECT COALESCE(SUM(s.units * s.unit_price_paise),0) FROM organic_sales s WHERE s.product_id = p.id) AS organic_revenue_paise,
        (SELECT COALESCE(SUM(s.units),0) FROM organic_sales s WHERE s.product_id = p.id) AS organic_units
      FROM products p WHERE p.merchant_id = ? ORDER BY p.name`
  ).all(merchantId) as any[];

  const withTotals = rows.map((r) => ({
    ...r,
    total_revenue_paise: r.agent_revenue_paise + r.organic_revenue_paise,
    total_units: r.agent_units + r.organic_units,
    margin_pct_at_list: ((r.list_price_paise - r.cogs_paise) / r.list_price_paise) * 100,
  }));
  const max = Math.max(...withTotals.map((r) => r.total_revenue_paise), 1);
  return withTotals
    .map((r) => ({ ...r, share_pct: (r.total_revenue_paise / max) * 100 }))
    .sort((a, b) => b.total_revenue_paise - a.total_revenue_paise);
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export function analytics(merchantId: string, range: Range = '30d') {
  const db = getDb();
  const since = sinceClause(range);

  const statusRows = db.prepare(
    `SELECT status, COUNT(*) AS n, COALESCE(SUM(amount_paise),0) AS amount
       FROM orders WHERE merchant_id = ? AND created_at >= ${since} GROUP BY status ORDER BY n DESC`
  ).all(merchantId) as any[];

  const aov = db.prepare(
    `SELECT COALESCE(AVG(amount_paise),0) AS v FROM orders
      WHERE merchant_id = ? AND status IN ('PAID','PARTIALLY_REFUNDED') AND created_at >= ${since}`
  ).get(merchantId) as { v: number };

  const hourly = db.prepare(
    `SELECT CAST(strftime('%H', created_at, 'localtime') AS INTEGER) AS hour, COUNT(*) AS n,
            COALESCE(SUM(CASE WHEN status IN ('PAID','PARTIALLY_REFUNDED') THEN amount_paise ELSE 0 END),0) AS amount
       FROM orders WHERE merchant_id = ? AND created_at >= ${since} GROUP BY hour ORDER BY hour`
  ).all(merchantId) as any[];

  const failures = db.prepare(
    `SELECT COALESCE(pay.error_description, o.failure_reason, 'unspecified') AS reason, COUNT(*) AS n
       FROM orders o LEFT JOIN payments pay ON pay.order_id = o.id AND pay.status='failed'
      WHERE o.merchant_id = ? AND o.status = 'FAILED' AND o.created_at >= ${since}
      GROUP BY reason ORDER BY n DESC LIMIT 8`
  ).all(merchantId) as any[];

  const agentImpact = db.prepare(
    `SELECT
        (SELECT COUNT(*) FROM opportunities WHERE merchant_id = @m) AS opportunities_detected,
        (SELECT COUNT(*) FROM risk_decisions rd JOIN opportunities o ON o.id = rd.opportunity_id
          WHERE o.merchant_id = @m AND rd.verdict = 'VETOED') AS offers_vetoed,
        (SELECT COUNT(*) FROM risk_decisions rd JOIN opportunities o ON o.id = rd.opportunity_id
          WHERE o.merchant_id = @m AND rd.verdict = 'APPROVED') AS offers_approved,
        (SELECT COUNT(*) FROM campaigns WHERE merchant_id = @m) AS campaigns,
        (SELECT COALESCE(SUM(revenue_paise),0) FROM campaigns WHERE merchant_id = @m) AS campaign_revenue_paise,
        (SELECT COALESCE(SUM(discount_cost_paise),0) FROM campaigns WHERE merchant_id = @m) AS discount_cost_paise`
  ).get({ m: merchantId }) as any;

  const learning = db.prepare(
    `SELECT oo.*, p.name AS product_name, p.list_price_paise FROM offer_outcomes oo
       JOIN products p ON p.id = oo.product_id WHERE oo.merchant_id = ? ORDER BY p.name, oo.price_paise DESC`
  ).all(merchantId) as any[];

  return {
    range,
    orderStatus: statusRows,
    averageOrderValuePaise: Math.round(aov.v),
    hourly,
    failureReasons: failures,
    paymentMethods: payments(merchantId, { limit: 1 }).methods,
    agentImpact,
    learning,
    series: revenueSeries(merchantId, range),
  };
}

// ---------------------------------------------------------------------------
// Campaigns (what TooEz calls "marketing" — agent-generated offers)
// ---------------------------------------------------------------------------

export function campaigns(merchantId: string) {
  return getDb().prepare(
    `SELECT c.*, p.name AS product_name, p.list_price_paise, p.cogs_paise,
            o.discount_pct, o.margin_pct, o.expected_conversions, o.expected_revenue_paise,
            o.reasoning, o.strategy,
            (SELECT COUNT(*) FROM orders ord WHERE ord.campaign_id = c.id) AS order_count
       FROM campaigns c
       JOIN products p ON p.id = c.product_id
       JOIN offers   o ON o.id = c.offer_id
      WHERE c.merchant_id = ? ORDER BY c.created_at DESC LIMIT 50`
  ).all(merchantId);
}
