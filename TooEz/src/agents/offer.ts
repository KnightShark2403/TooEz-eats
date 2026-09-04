import { getDb } from '@/lib/db';
import { id } from '@/lib/ids';
import { audit } from '@/lib/audit';
import { inr, discountPct, marginPct, pct } from '@/lib/money';
import { buildLadder } from './pricing-model';
import { narrate } from '@/lib/llm';
import type { DetectionSignals, OfferConstraints, OfferProposal, Opportunity, PricePoint, Product } from './types';

/**
 * OFFER / PRICING AGENT
 *
 * Objective: maximise expected revenue recovered from at-risk inventory inside
 * the detection window.
 *
 * IMPORTANT — SEPARATION OF DUTIES: this agent deliberately has NO access to
 * the `policies` table. It cannot read the merchant's margin floor, discount
 * cap or budget. It is a revenue optimiser, and left alone it will happily
 * propose a price that destroys margin. That is precisely why the Risk Agent
 * exists as an independent component with its own data access, and why its
 * veto is a real control rather than a second opinion.
 *
 * After a veto the Risk Agent hands back machine-readable CONSTRAINTS (not a
 * price). This agent re-optimises inside the reduced feasible set. It never
 * simply "tries a higher number".
 */

export async function proposeOffer(args: {
  merchantId: string;
  opportunity: Opportunity;
  product: Product;
  attempt: number;
  constraints?: OfferConstraints;
}): Promise<OfferProposal> {
  const { merchantId, opportunity, product, attempt } = args;
  const c = args.constraints ?? {};
  const signals: DetectionSignals = JSON.parse(opportunity.signals_json);

  const maxUnits = Math.min(c.maxUnits ?? product.stock_units, product.stock_units);
  const fullLadder = buildLadder(product, signals.audienceEstimate, maxUnits);

  let feasible = fullLadder.filter((p) => {
    if (c.minPricePaise !== undefined && p.price_paise < c.minPricePaise) return false;
    if (c.excludePrices?.includes(p.price_paise)) return false;
    if (c.maxExposurePaise !== undefined) {
      const exposure = (product.list_price_paise - p.price_paise) * maxUnits;
      if (exposure > c.maxExposurePaise) return false;
    }
    return true;
  });

  if (feasible.length === 0) {
    // Constraints eliminated the whole ladder — fall back to list price, which
    // is always feasible on margin, and let the Risk Agent judge it.
    feasible = fullLadder.filter((p) => p.price_paise === product.list_price_paise);
  }

  const best = feasible.reduce((a, b) => (b.expected_revenue_paise > a.expected_revenue_paise ? b : a));

  const strategy: OfferProposal['strategy'] =
    attempt > 1 ? 'CONSTRAINT_REPAIR' : best.observed_impressions === 0 ? 'EXPLORE' : 'LEARNED';

  const unitsOffered = Math.min(maxUnits, Math.max(1, Math.ceil(best.expected_conversions * 1.6)));
  const expectedMargin = Math.round(best.expected_conversions * (best.price_paise - product.cogs_paise));

  const runnerUp = feasible
    .filter((p) => p.price_paise !== best.price_paise)
    .sort((a, b) => b.expected_revenue_paise - a.expected_revenue_paise)[0];

  const facts = {
    product: product.name,
    price: inr(best.price_paise),
    listPrice: inr(product.list_price_paise),
    discount: pct(best.discount_pct),
    windowMinutes: opportunity.window_minutes,
    demandTrend: signals.demandTrend,
    stock: product.stock_units,
    audience: signals.audienceEstimate,
    conversionRate: pct(best.conversion_rate * 100, 1),
    conversionEvidence: best.observed_impressions > 0
      ? `${best.observed_conversions}/${best.observed_impressions} conversions observed at this price in past campaigns`
      : 'no prior campaign at this price — prior elasticity curve used (exploration)',
    expectedConversions: best.expected_conversions.toFixed(1),
    expectedRevenue: inr(best.expected_revenue_paise),
    runnerUp: runnerUp
      ? `${inr(runnerUp.price_paise)} was the next best at ${inr(runnerUp.expected_revenue_paise)} (${pct(runnerUp.conversion_rate * 100)} conversion)`
      : 'no alternative price point was feasible',
    constraintNote: c.note ?? null,
    attempt,
  };

  const reasoning = await narrate('offer', facts, deterministicOfferReasoning(facts));

  const offerId = id('off');
  getDb().prepare(
    `INSERT INTO offers (id,opportunity_id,attempt,offer_price_paise,bundle_label,discount_pct,
      expected_conversions,expected_revenue_paise,expected_margin_paise,margin_pct,units_offered,
      strategy,reasoning,reasoning_source)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(offerId, opportunity.id, attempt, best.price_paise, bundleLabel(product, best),
    best.discount_pct, best.expected_conversions, best.expected_revenue_paise, expectedMargin,
    marginPct(best.price_paise, product.cogs_paise), unitsOffered, strategy,
    reasoning.text, reasoning.source);

  audit({
    merchantId, actor: 'OFFER_AGENT',
    action: attempt === 1 ? 'OFFER_PROPOSED' : 'OFFER_REVISED',
    severity: 'info', opportunityId: opportunity.id,
    summary: attempt === 1
      ? `Proposed ${inr(best.price_paise)} (${pct(best.discount_pct)} off) — expected ${best.expected_conversions.toFixed(1)} conversions, ${inr(best.expected_revenue_paise)}`
      : `Revised to ${inr(best.price_paise)} after constraint repair — expected ${inr(best.expected_revenue_paise)}`,
    detail: { attempt, strategy, chosen: best, feasibleCount: feasible.length, constraints: c, ladder: fullLadder },
  });

  return {
    id: offerId, opportunity_id: opportunity.id, attempt,
    offer_price_paise: best.price_paise, bundle_label: bundleLabel(product, best),
    discount_pct: best.discount_pct, expected_conversions: best.expected_conversions,
    expected_revenue_paise: best.expected_revenue_paise, expected_margin_paise: expectedMargin,
    margin_pct: +marginPct(best.price_paise, product.cogs_paise).toFixed(2),
    units_offered: unitsOffered, strategy,
    reasoning: reasoning.text, reasoning_source: reasoning.source,
    ladder: fullLadder,
  };
}

function bundleLabel(product: Product, p: PricePoint): string {
  if (p.discount_pct < 1) return product.name;
  return `${product.name} — flash price`;
}

function deterministicOfferReasoning(f: Record<string, unknown>): string {
  const parts = [
    `Demand for ${f.product} is ${String(f.demandTrend).toLowerCase()} and ${f.stock} units remain against a ${f.windowMinutes}-minute window.`,
    `Across the candidate price ladder, ${f.price} maximises expected revenue at ${f.expectedRevenue} (${f.expectedConversions} conversions from an estimated ${f.audience} impressions at a ${f.conversionRate} conversion rate).`,
    `Evidence: ${f.conversionEvidence}.`,
    `${f.runnerUp}.`,
  ];
  if (f.constraintNote) parts.push(`Re-optimised under risk constraints: ${f.constraintNote}`);
  return parts.join(' ');
}
