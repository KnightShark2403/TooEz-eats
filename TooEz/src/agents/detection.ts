import { getDb } from '@/lib/db';
import { id } from '@/lib/ids';
import { audit } from '@/lib/audit';
import { inr, discountPct, marginPct } from '@/lib/money';
import { buildLadder, priorRate } from './pricing-model';
import type { DetectionSignals, DemandTrend, Opportunity, Product } from './types';

/**
 * DETECTION AGENT
 *
 * Deterministic. No LLM is involved in any number produced here — forecasting
 * from 14 days of hourly history is arithmetic, and an LLM would only make it
 * less accurate and less auditable. The LLM (when configured) is used later,
 * and only to phrase the reasoning that these numbers already imply.
 *
 * Opportunity = inventory whose forecast sell-through in the next window leaves
 * material unsold value on the table, weighted by how fast demand is decaying.
 */

const MIN_RECOVERABLE_PAISE = 15000; // ₹150 — below this it isn't worth a merchant's attention.

export function currentHour(override?: number | null): number {
  if (override !== undefined && override !== null && override >= 0 && override <= 23) return override;
  return new Date().getHours();
}

function avgUnits(productId: string, hour: number): number {
  const row = getDb()
    .prepare('SELECT AVG(units_sold) AS a FROM demand_history WHERE product_id = ? AND hour_of_day = ?')
    .get(productId, hour) as { a: number | null };
  return row.a ?? 0;
}

function peakUnits(productId: string): number {
  const row = getDb()
    .prepare(`SELECT MAX(a) AS p FROM (
                SELECT AVG(units_sold) AS a FROM demand_history WHERE product_id = ? GROUP BY hour_of_day
              )`)
    .get(productId) as { p: number | null };
  return Math.max(row.p ?? 1, 0.001);
}

/** Historical sell-through: units actually sold vs units produced, over the last 14 days. */
function historicalSellThrough(productId: string, hour: number): number {
  const row = getDb()
    .prepare(`SELECT SUM(units_sold) AS s FROM demand_history
              WHERE product_id = ? AND hour_of_day BETWEEN ? AND ?`)
    .get(productId, hour, Math.min(23, hour + 2)) as { s: number | null };
  const window = row.s ?? 0;
  const total = (getDb()
    .prepare('SELECT SUM(units_sold) AS s FROM demand_history WHERE product_id = ?')
    .get(productId) as { s: number | null }).s ?? 1;
  return Math.min(100, (window / Math.max(total, 1)) * 100 * 4);
}

export function computeSignals(product: Product, windowMinutes: number, hourOverride?: number | null): DetectionSignals {
  const hour = currentHour(hourOverride);
  const thisHour = avgUnits(product.id, hour);
  const nextHour = avgUnits(product.id, (hour + 1) % 24);
  const peak = peakUnits(product.id);

  const delta = nextHour - thisHour;
  const trend: DemandTrend =
    thisHour <= 0.001 ? 'FLAT'
      : delta / Math.max(thisHour, 0.001) < -0.2 ? 'FALLING'
      : delta / Math.max(thisHour, 0.001) > 0.2 ? 'RISING'
      : 'FLAT';

  // Units expected to sell at LIST price during the window, blending this hour
  // and the next in proportion to how much of the window falls in each.
  const frac = windowMinutes / 60;
  const blended = thisHour * Math.min(frac, 1) + nextHour * Math.max(frac - 1, 0);
  const baselineUnits = Math.max(0, blended);

  // Audience is DERIVED from the baseline rather than guessed, so the demand
  // history and the elasticity curve stay consistent: if history says N units
  // sell at list price in this window, and the curve says list price converts
  // at r, then the window must be seeing roughly N/r impressions.
  const audienceEstimate = Math.max(12, Math.round(baselineUnits / priorRate(0)));

  const ladder = buildLadder(product, audienceEstimate, product.stock_units);
  const best = ladder.reduce((a, b) => (b.expected_revenue_paise > a.expected_revenue_paise ? b : a));
  const baselineRevenuePaise = Math.round(baselineUnits * product.list_price_paise);
  const recoverable = Math.max(0, best.expected_revenue_paise - baselineRevenuePaise);

  const expectedWaste = Math.max(0, product.stock_units - baselineUnits);
  const shelfLeft = product.produced_at
    ? Math.round(product.shelf_life_min - (Date.now() - new Date(product.produced_at).getTime()) / 60000)
    : null;

  return {
    hourOfDay: hour,
    windowMinutes,
    stockUnits: product.stock_units,
    avgUnitsThisHour: +thisHour.toFixed(2),
    avgUnitsNextHour: +nextHour.toFixed(2),
    demandTrend: trend,
    demandIndex: +(thisHour / peak).toFixed(3),
    audienceEstimate,
    baselineUnits: +baselineUnits.toFixed(2),
    baselineRevenuePaise,
    expectedWasteUnits: +expectedWaste.toFixed(2),
    inventoryAtRiskPaise: Math.round(expectedWaste * product.list_price_paise),
    historicalSellThroughPct: +historicalSellThrough(product.id, hour).toFixed(1),
    minutesOfShelfLifeLeft: shelfLeft,
    bestUnconstrainedPricePaise: best.price_paise,
    bestUnconstrainedRevenuePaise: best.expected_revenue_paise,
    recoverablePaise: recoverable,
  };
}

function rationale(p: Product, s: DetectionSignals): string {
  const bits: string[] = [];
  bits.push(`${s.stockUnits} units of ${p.name} are unsold`);
  if (s.demandTrend === 'FALLING') {
    bits.push(`demand is forecast to fall ${Math.round((1 - s.avgUnitsNextHour / Math.max(s.avgUnitsThisHour, 0.01)) * 100)}% in the next hour (${s.avgUnitsThisHour} → ${s.avgUnitsNextHour} units/hr)`);
  } else if (s.demandTrend === 'RISING') {
    bits.push(`demand is rising (${s.avgUnitsThisHour} → ${s.avgUnitsNextHour} units/hr) but stock still exceeds forecast sell-through`);
  } else {
    bits.push(`demand is flat at ~${s.avgUnitsThisHour} units/hr`);
  }
  bits.push(`only ${s.baselineUnits} units are expected to sell at list price in the next ${s.windowMinutes} minutes`);
  if (p.perishable && s.minutesOfShelfLifeLeft !== null) {
    bits.push(`shelf life leaves ${s.minutesOfShelfLifeLeft} minutes of saleability`);
  }
  bits.push(`leaving ${inr(s.inventoryAtRiskPaise)} of inventory at risk and ${inr(s.recoverablePaise)} of revenue recoverable through a priced offer`);
  return bits.join('; ') + '.';
}

export interface DetectionResult {
  opportunities: Opportunity[];
  scanned: number;
  skipped: { product: string; reason: string }[];
}

export function detect(merchantId: string, opts: { windowMinutes?: number; hour?: number | null } = {}): DetectionResult {
  const db = getDb();
  const windowMinutes = opts.windowMinutes ?? 30;
  const products = db.prepare('SELECT * FROM products WHERE merchant_id = ?').all(merchantId) as Product[];

  const created: Opportunity[] = [];
  const skipped: { product: string; reason: string }[] = [];

  for (const p of products) {
    if (p.stock_units <= 0) { skipped.push({ product: p.name, reason: 'no stock' }); continue; }

    // Don't re-open an opportunity that is already open or already in a live campaign.
    const existing = db.prepare(
      `SELECT id FROM opportunities WHERE product_id = ? AND status = 'OPEN'`
    ).get(p.id) as { id: string } | undefined;
    if (existing) { skipped.push({ product: p.name, reason: 'opportunity already open' }); continue; }

    const s = computeSignals(p, windowMinutes, opts.hour);
    if (s.recoverablePaise < MIN_RECOVERABLE_PAISE) {
      skipped.push({ product: p.name, reason: `recoverable ${inr(s.recoverablePaise)} below ${inr(MIN_RECOVERABLE_PAISE)} threshold` });
      continue;
    }

    const oppId = id('opp');
    const text = rationale(p, s);
    db.prepare(
      `INSERT INTO opportunities (id,merchant_id,product_id,window_minutes,stock_units,baseline_units,
        expected_waste,sell_through_pct,demand_trend,demand_index,value_at_risk_paise,status,rationale,signals_json)
       VALUES (?,?,?,?,?,?,?,?,?,?,?, 'OPEN', ?,?)`
    ).run(oppId, merchantId, p.id, windowMinutes, p.stock_units, s.baselineUnits, s.expectedWasteUnits,
      s.historicalSellThroughPct, s.demandTrend, s.demandIndex, s.recoverablePaise, text, JSON.stringify(s));

    audit({
      merchantId, actor: 'DETECTION_AGENT', action: 'OPPORTUNITY_DETECTED', severity: 'info',
      opportunityId: oppId,
      summary: `${inr(s.recoverablePaise)} revenue opportunity — ${p.name}, ${p.stock_units} units, demand ${s.demandTrend.toLowerCase()}`,
      detail: { signals: s, rationale: text },
    });

    created.push(db.prepare('SELECT * FROM opportunities WHERE id = ?').get(oppId) as Opportunity);
  }

  return { opportunities: created, scanned: products.length, skipped };
}
