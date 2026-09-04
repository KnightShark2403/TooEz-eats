import { getDb } from '@/lib/db';
import { id } from '@/lib/ids';
import { audit } from '@/lib/audit';
import { inr, pct, marginPct, discountPct } from '@/lib/money';
import type { OfferConstraints, OfferProposal, Opportunity, Policies, Product, RiskCheck, RiskDecision } from './types';

/**
 * INDEPENDENT RISK AGENT
 *
 * This agent is not a second LLM opinion on the Offer Agent's work. It is a
 * deterministic policy engine with its own data access:
 *
 *   - It reads `policies` (the Offer Agent cannot).
 *   - It reads `campaigns` to compute today's committed discount spend.
 *   - It reads `organic_sales` to detect cannibalization of full-price demand.
 *   - It recomputes margin from `products.cogs_paise` itself. It does NOT
 *     trust the margin number the Offer Agent reported.
 *
 * Every rule returns observed-vs-limit. Any failing rule vetoes the offer, and
 * the veto is the terminal state for that offer: no campaign row is created,
 * so no Razorpay order can ever be created against a vetoed price.
 *
 * On veto it emits machine-readable REMEDIATION — the feasible set, not a
 * suggested price — which the Offer Agent re-optimises inside.
 */

export function getPolicies(merchantId: string): Policies {
  return getDb().prepare('SELECT * FROM policies WHERE merchant_id = ?').get(merchantId) as Policies;
}

/** Discount subsidy already committed today across live + completed campaigns. */
export function discountSpentToday(merchantId: string): number {
  const row = getDb().prepare(
    `SELECT COALESCE(SUM(discount_cost_paise),0) AS spent FROM campaigns
      WHERE merchant_id = ? AND date(created_at) = date('now','localtime')
        AND status IN ('LIVE','COMPLETED','PENDING_APPROVAL')`
  ).get(merchantId) as { spent: number };
  return row.spent;
}

export function activeCampaignCount(merchantId: string): number {
  const row = getDb().prepare(
    `SELECT COUNT(*) AS n FROM campaigns WHERE merchant_id = ? AND status IN ('LIVE','PENDING_APPROVAL')`
  ).get(merchantId) as { n: number };
  return row.n;
}

/** Units of this SKU sold at (near) list price inside the cannibalization window. */
export function recentFullPriceUnits(product: Product, windowMin: number): number {
  const row = getDb().prepare(
    `SELECT COALESCE(SUM(units),0) AS u FROM organic_sales
      WHERE product_id = ? AND unit_price_paise >= ?
        AND sold_at >= datetime('now','localtime', ?)`
  ).get(product.id, Math.round(product.list_price_paise * 0.95), `-${windowMin} minutes`) as { u: number };
  return row.u;
}

const CANNIBALIZATION_UNIT_THRESHOLD = 3;

export function evaluate(args: {
  merchantId: string;
  offer: OfferProposal;
  product: Product;
  opportunity: Opportunity;
}): RiskDecision {
  const { merchantId, offer, product, opportunity } = args;
  const pol = getPolicies(merchantId);
  const checks: RiskCheck[] = [];

  // ---- 1. Minimum gross margin -----------------------------------------
  // Recomputed from source cost. The Offer Agent's own margin claim is ignored.
  const realMargin = marginPct(offer.offer_price_paise, product.cogs_paise);
  checks.push({
    rule: 'MIN_MARGIN',
    label: 'Minimum gross margin',
    passed: realMargin >= pol.min_margin_pct,
    observed: pct(realMargin),
    limit: `≥ ${pct(pol.min_margin_pct, 0)}`,
    detail: `Unit cost ${inr(product.cogs_paise)} against an offer price of ${inr(offer.offer_price_paise)} yields ${pct(realMargin)} gross margin.`,
  });

  // ---- 2. Maximum discount depth ---------------------------------------
  const realDiscount = discountPct(product.list_price_paise, offer.offer_price_paise);
  checks.push({
    rule: 'MAX_DISCOUNT',
    label: 'Maximum discount depth',
    passed: realDiscount <= pol.max_discount_pct,
    observed: pct(realDiscount),
    limit: `≤ ${pct(pol.max_discount_pct, 0)}`,
    detail: `${inr(offer.offer_price_paise)} is ${pct(realDiscount)} off the ${inr(product.list_price_paise)} list price.`,
  });

  // ---- 3. Single-campaign exposure -------------------------------------
  const exposure = (product.list_price_paise - offer.offer_price_paise) * offer.units_offered;
  checks.push({
    rule: 'MAX_CAMPAIGN_EXPOSURE',
    label: 'Single-campaign exposure',
    passed: exposure <= pol.max_campaign_exposure_paise,
    observed: inr(exposure),
    limit: `≤ ${inr(pol.max_campaign_exposure_paise)}`,
    detail: `${offer.units_offered} units × ${inr(product.list_price_paise - offer.offer_price_paise)} subsidy = ${inr(exposure)} at risk on this campaign alone.`,
  });

  // ---- 4. Daily discount budget ----------------------------------------
  const spent = discountSpentToday(merchantId);
  const wouldBe = spent + exposure;
  checks.push({
    rule: 'DAILY_DISCOUNT_BUDGET',
    label: 'Daily discount budget',
    passed: wouldBe <= pol.daily_discount_budget_paise,
    observed: `${inr(wouldBe)} of ${inr(pol.daily_discount_budget_paise)}`,
    limit: `≤ ${inr(pol.daily_discount_budget_paise)}/day`,
    detail: `${inr(spent)} already committed today across ${activeCampaignCount(merchantId)} active + completed campaigns; this offer would add ${inr(exposure)}.`,
  });

  // ---- 5. Concurrent campaign cap --------------------------------------
  const active = activeCampaignCount(merchantId);
  checks.push({
    rule: 'MAX_ACTIVE_CAMPAIGNS',
    label: 'Concurrent campaign cap',
    passed: active < pol.max_active_campaigns,
    observed: `${active} active`,
    limit: `< ${pol.max_active_campaigns}`,
    detail: `Running more than ${pol.max_active_campaigns} discounted campaigns at once trains customers to wait for offers.`,
  });

  // ---- 6. Cannibalization ----------------------------------------------
  const fullPriceUnits = recentFullPriceUnits(product, pol.cannibalization_window_min);
  checks.push({
    rule: 'CANNIBALIZATION',
    label: 'Full-price cannibalization',
    passed: fullPriceUnits < CANNIBALIZATION_UNIT_THRESHOLD,
    observed: `${fullPriceUnits} units at list in last ${pol.cannibalization_window_min}m`,
    limit: `< ${CANNIBALIZATION_UNIT_THRESHOLD} units`,
    detail: fullPriceUnits >= CANNIBALIZATION_UNIT_THRESHOLD
      ? `${product.name} is still clearing at full price. Discounting now would convert paying demand into discounted demand.`
      : `No material full-price demand for ${product.name} in the last ${pol.cannibalization_window_min} minutes, so discounting does not displace paying customers.`,
  });

  // ---- 7. Sanity: never sell below cost ---------------------------------
  checks.push({
    rule: 'BELOW_COST',
    label: 'Below-cost guard',
    passed: offer.offer_price_paise > product.cogs_paise,
    observed: inr(offer.offer_price_paise),
    limit: `> ${inr(product.cogs_paise)} unit cost`,
    detail: 'A hard stop independent of the configurable margin floor.',
  });

  const failed = checks.filter((c) => !c.passed);
  const verdict = failed.length === 0 ? 'APPROVED' : 'VETOED';

  const remediation = verdict === 'VETOED'
    ? buildRemediation(failed, pol, product, offer, spent)
    : null;

  const primaryReason = verdict === 'APPROVED'
    ? `All ${checks.length} policy checks passed.`
    : failed.map((f) => `${f.label}: ${f.observed} vs ${f.limit}`).join(' · ');

  const decisionId = id('rsk');
  getDb().prepare(
    `INSERT INTO risk_decisions (id,offer_id,opportunity_id,verdict,checks_json,violated_rules,primary_reason,remediation_json)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(decisionId, offer.id, opportunity.id, verdict, JSON.stringify(checks),
    failed.map((f) => f.rule).join(','), primaryReason,
    remediation ? JSON.stringify(remediation) : null);

  audit({
    merchantId, actor: 'RISK_AGENT',
    action: verdict === 'APPROVED' ? 'OFFER_APPROVED' : 'OFFER_VETOED',
    severity: verdict === 'APPROVED' ? 'success' : 'veto',
    opportunityId: opportunity.id,
    summary: verdict === 'APPROVED'
      ? `APPROVED ${inr(offer.offer_price_paise)} — ${checks.length}/${checks.length} policy checks passed`
      : `VETOED ${inr(offer.offer_price_paise)} — ${failed.map((f) => f.label).join(', ')}`,
    detail: { verdict, checks, remediation, offerId: offer.id, attempt: offer.attempt },
  });

  return {
    id: decisionId, offer_id: offer.id, opportunity_id: opportunity.id,
    verdict, checks, violatedRules: failed.map((f) => f.rule),
    primaryReason, remediation,
  };
}

/**
 * Translates failed rules into a feasible set for the Offer Agent.
 * Deliberately returns CONSTRAINTS, never a price — the Risk Agent does not
 * do pricing, and the Offer Agent does not do policy.
 */
function buildRemediation(
  failed: RiskCheck[], pol: Policies, product: Product, offer: OfferProposal, spentToday: number
): OfferConstraints {
  const rules = new Set(failed.map((f) => f.rule));
  const c: OfferConstraints = {};
  const notes: string[] = [];

  const minPrices: number[] = [];
  if (rules.has('MIN_MARGIN')) {
    // price such that (price - cogs)/price >= minMargin  =>  price >= cogs / (1 - m)
    const p = Math.ceil(product.cogs_paise / (1 - pol.min_margin_pct / 100));
    minPrices.push(p);
    notes.push(`margin floor requires ≥ ${inr(p, { decimals: true })}`);
  }
  if (rules.has('BELOW_COST')) {
    minPrices.push(product.cogs_paise + 1);
  }
  if (rules.has('MAX_DISCOUNT')) {
    const p = Math.ceil(product.list_price_paise * (1 - pol.max_discount_pct / 100));
    minPrices.push(p);
    notes.push(`discount cap requires ≥ ${inr(p, { decimals: true })}`);
  }
  if (minPrices.length) c.minPricePaise = Math.max(...minPrices);

  if (rules.has('MAX_CAMPAIGN_EXPOSURE') || rules.has('DAILY_DISCOUNT_BUDGET')) {
    const budgetHeadroom = Math.max(0, pol.daily_discount_budget_paise - spentToday);
    const cap = Math.min(pol.max_campaign_exposure_paise, budgetHeadroom);
    c.maxExposurePaise = cap;
    notes.push(`total subsidy on this campaign must stay under ${inr(cap)}`);
  }
  if (rules.has('MAX_ACTIVE_CAMPAIGNS') || rules.has('CANNIBALIZATION')) {
    // These are not repairable by re-pricing. Signal an empty feasible set.
    c.minPricePaise = product.list_price_paise;
    notes.push(rules.has('CANNIBALIZATION')
      ? 'this SKU is still clearing at list price — no discount is permissible right now'
      : 'the concurrent-campaign cap is already met — no new discounted campaign is permissible');
  }

  c.excludePrices = [offer.offer_price_paise];
  c.note = notes.join('; ');
  return c;
}
