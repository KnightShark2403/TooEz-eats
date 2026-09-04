import { getDb } from '@/lib/db';
import { discountPct, marginPct } from '@/lib/money';
import type { PricePoint, Product } from './types';

/**
 * Shared demand/elasticity model.
 *
 * This is deterministic statistics, not an LLM. Two ingredients:
 *   1. A logistic price-elasticity PRIOR — conversion rises with discount depth.
 *   2. OBSERVED outcomes from past campaigns, held in `offer_outcomes`.
 *
 * They are combined by Bayesian shrinkage toward the prior, so a price point
 * with 155 real impressions dominates the prior, while an untried price point
 * falls back to it and is flagged as exploration. This is the learning loop:
 * every settled campaign updates `offer_outcomes`, which changes the curve,
 * which changes the next recommendation.
 */

// Audience/impressions are derived in the Detection Agent as baselineUnits / priorRate(0),
// which keeps the demand history and this elasticity curve describing the same world.
const PRIOR_STRENGTH = 40;                // pseudo-impressions of prior belief
const P_MIN = 0.015;                      // conversion at 0% discount
const P_MAX = 0.200;                      // asymptotic conversion at deep discount
const K = 0.16;                           // logistic steepness
const D50 = 32;                           // discount % at the curve's midpoint

/** Prior conversion probability at a given discount depth. */
export function priorRate(discount: number): number {
  return P_MIN + (P_MAX - P_MIN) * (1 / (1 + Math.exp(-K * (discount - D50))));
}

export interface Observation { price_paise: number; impressions: number; conversions: number; }

export function observations(merchantId: string, productId: string): Observation[] {
  return getDb()
    .prepare(`SELECT price_paise, impressions, conversions FROM offer_outcomes
              WHERE merchant_id = ? AND product_id = ? ORDER BY price_paise DESC`)
    .all(merchantId, productId) as Observation[];
}

/**
 * Candidate price ladder: ₹10 steps down from list price, never below half list.
 * Steps preserve the list price's ending digit, so a ₹149 item produces
 * ₹139/₹129/₹119/₹109/₹99/₹89/₹79 rather than round hundreds — real retail
 * price points, and easier for a merchant to sanity-check at a glance.
 */
export function priceLadder(listPaise: number): number[] {
  const step = 1000; // ₹10
  const floor = Math.round(listPaise * 0.5);
  const out: number[] = [];
  for (let p = listPaise; p >= floor; p -= step) out.push(p);
  return out;
}

export function buildLadder(product: Product, audience: number, stockUnits: number): PricePoint[] {
  const obs = observations(product.merchant_id, product.id);
  const byPrice = new Map(obs.map((o) => [o.price_paise, o]));

  return priceLadder(product.list_price_paise).map((price) => {
    const d = discountPct(product.list_price_paise, price);
    const prior = priorRate(d);
    const o = byPrice.get(price);
    const imp = o?.impressions ?? 0;
    const conv = o?.conversions ?? 0;
    // Bayesian shrinkage: observed counts + prior pseudo-counts.
    const rate = (conv + prior * PRIOR_STRENGTH) / (imp + PRIOR_STRENGTH);
    const expectedConv = Math.min(stockUnits, audience * rate);
    return {
      price_paise: price,
      discount_pct: +d.toFixed(2),
      conversion_rate: +rate.toFixed(4),
      observed_impressions: imp,
      observed_conversions: conv,
      source: imp === 0 ? 'prior' : imp >= 100 ? 'observed' : 'blended',
      expected_conversions: +expectedConv.toFixed(2),
      expected_revenue_paise: Math.round(expectedConv * price),
      margin_pct: +marginPct(price, product.cogs_paise).toFixed(2),
    } satisfies PricePoint;
  });
}

/** Record a realised campaign outcome. This is what makes the loop close. */
export function recordOutcome(args: {
  merchantId: string; productId: string; pricePaise: number; listPaise: number;
  impressions: number; conversions: number; revenuePaise: number;
}) {
  const bucket = Math.round(discountPct(args.listPaise, args.pricePaise) / 5) * 5;
  const discountCost = (args.listPaise - args.pricePaise) * args.conversions;
  getDb().prepare(
    `INSERT INTO offer_outcomes (merchant_id,product_id,price_paise,discount_bucket,impressions,conversions,revenue_paise,discount_cost_paise)
     VALUES (?,?,?,?,?,?,?,?)
     ON CONFLICT(merchant_id,product_id,price_paise) DO UPDATE SET
       impressions = impressions + excluded.impressions,
       conversions = conversions + excluded.conversions,
       revenue_paise = revenue_paise + excluded.revenue_paise,
       discount_cost_paise = discount_cost_paise + excluded.discount_cost_paise,
       updated_at = datetime('now')`
  ).run(args.merchantId, args.productId, args.pricePaise, bucket,
    args.impressions, args.conversions, args.revenuePaise, discountCost);
}
