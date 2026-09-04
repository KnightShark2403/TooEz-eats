import { getDb } from '@/lib/db';
import { id } from '@/lib/ids';
import { audit } from '@/lib/audit';
import { publishRefresh } from '@/lib/events';
import { inr } from '@/lib/money';
import { proposeOffer } from './offer';
import { evaluate, getPolicies } from './risk';
import type { OfferConstraints, OfferProposal, Opportunity, Product, RiskDecision } from './types';

export const MAX_NEGOTIATION_ROUNDS = 3;

export interface Round { offer: OfferProposal; decision: RiskDecision }

export interface PipelineResult {
  opportunityId: string;
  rounds: Round[];
  outcome: 'CAMPAIGN_PENDING_APPROVAL' | 'CAMPAIGN_LIVE' | 'ABANDONED';
  campaignId: string | null;
  abandonReason?: string;
}

/**
 * Runs the negotiation between the Offer Agent and the Risk Agent for one
 * opportunity. The loop is genuinely adversarial: the Offer Agent optimises
 * revenue, the Risk Agent enforces policy, and the loop terminates either when
 * the Risk Agent approves or when the feasible set is empty.
 *
 * A campaign row — the only object a Razorpay order can ever be attached to —
 * is created ONLY after an APPROVED verdict.
 */
export async function runPipeline(merchantId: string, opportunityId: string): Promise<PipelineResult> {
  const db = getDb();
  const opportunity = db.prepare('SELECT * FROM opportunities WHERE id = ?').get(opportunityId) as Opportunity;
  if (!opportunity) throw new Error('opportunity not found');
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(opportunity.product_id) as Product;
  const policies = getPolicies(merchantId);

  const rounds: Round[] = [];
  let constraints: OfferConstraints | undefined;

  for (let attempt = 1; attempt <= MAX_NEGOTIATION_ROUNDS; attempt++) {
    const offer = await proposeOffer({ merchantId, opportunity, product, attempt, constraints });
    const decision = evaluate({ merchantId, offer, product, opportunity });
    rounds.push({ offer, decision });

    if (decision.verdict === 'APPROVED') {
      const campaignId = createCampaign({ merchantId, opportunity, offer, product, policies });
      db.prepare(`UPDATE opportunities SET status='PROCESSED' WHERE id = ?`).run(opportunityId);
      publishRefresh('pipeline-approved');
      return {
        opportunityId, rounds, campaignId,
        outcome: policies.require_merchant_approval ? 'CAMPAIGN_PENDING_APPROVAL' : 'CAMPAIGN_LIVE',
      };
    }

    // Vetoed. If the Risk Agent's remediation leaves no room to move, stop.
    const next = decision.remediation ?? {};
    const noRoom = next.minPricePaise !== undefined && next.minPricePaise >= product.list_price_paise;
    if (noRoom || attempt === MAX_NEGOTIATION_ROUNDS) {
      db.prepare(`UPDATE opportunities SET status='DISMISSED' WHERE id = ?`).run(opportunityId);
      const reason = noRoom
        ? (decision.violatedRules.includes('CANNIBALIZATION')
            ? 'SKU is still clearing at list price — any discount would cannibalize paying demand'
            : 'policy leaves no feasible discounted price')
        : `no policy-compliant price found within ${MAX_NEGOTIATION_ROUNDS} rounds`;
      audit({
        merchantId, actor: 'SYSTEM', action: 'PIPELINE_ABANDONED', severity: 'warn',
        opportunityId,
        summary: `Opportunity abandoned — ${reason}. No campaign created, no payment possible.`,
        detail: { rounds: rounds.length, violated: decision.violatedRules },
      });
      publishRefresh('pipeline-abandoned');
      return { opportunityId, rounds, outcome: 'ABANDONED', campaignId: null, abandonReason: reason };
    }
    constraints = next;
  }

  throw new Error('unreachable');
}

function createCampaign(args: {
  merchantId: string; opportunity: Opportunity; offer: OfferProposal; product: Product; policies: { require_merchant_approval: number };
}): string {
  const { merchantId, opportunity, offer, product, policies } = args;
  const db = getDb();
  const campaignId = id('cmp');
  const expiresAt = new Date(Date.now() + opportunity.window_minutes * 60_000)
    .toISOString().replace('T', ' ').slice(0, 19);
  const discountCost = (product.list_price_paise - offer.offer_price_paise) * offer.units_offered;
  const status = policies.require_merchant_approval ? 'PENDING_APPROVAL' : 'LIVE';

  db.prepare(
    `INSERT INTO campaigns (id,merchant_id,opportunity_id,offer_id,product_id,status,price_paise,
      units_offered,discount_cost_paise,expires_at,approved_by,approved_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(campaignId, merchantId, opportunity.id, offer.id, product.id, status,
    offer.offer_price_paise, offer.units_offered, discountCost, expiresAt,
    policies.require_merchant_approval ? null : 'auto', policies.require_merchant_approval ? null : new Date().toISOString());

  audit({
    merchantId, actor: 'SYSTEM', action: 'CAMPAIGN_CREATED', severity: 'info',
    opportunityId: opportunity.id, campaignId,
    summary: policies.require_merchant_approval
      ? `Campaign drafted at ${inr(offer.offer_price_paise)} × ${offer.units_offered} units — awaiting merchant approval`
      : `Campaign auto-approved at ${inr(offer.offer_price_paise)} (merchant approval disabled in policy)`,
    detail: { price: offer.offer_price_paise, units: offer.units_offered, discountCost, expiresAt },
  });
  return campaignId;
}

/** Merchant approval gate. Nothing sellable exists until this runs. */
export function approveCampaign(merchantId: string, campaignId: string, approver = 'merchant@demo') {
  const db = getDb();
  const c = db.prepare('SELECT * FROM campaigns WHERE id = ? AND merchant_id = ?').get(campaignId, merchantId) as
    { id: string; status: string; price_paise: number; units_offered: number; opportunity_id: string } | undefined;
  if (!c) throw new Error('campaign not found');
  if (c.status === 'LIVE') return { ok: true, alreadyLive: true };
  if (c.status !== 'PENDING_APPROVAL') throw new Error(`campaign is ${c.status}, cannot approve`);

  db.prepare(`UPDATE campaigns SET status='LIVE', approved_by=?, approved_at=datetime('now') WHERE id=?`)
    .run(approver, campaignId);
  audit({
    merchantId, actor: 'MERCHANT', action: 'CAMPAIGN_APPROVED', severity: 'success',
    campaignId, opportunityId: c.opportunity_id,
    summary: `Merchant approved the campaign — ${inr(c.price_paise)} × ${c.units_offered} units is now live to customers`,
    detail: { approver },
  });
  publishRefresh('campaign-approved');
  return { ok: true, alreadyLive: false };
}

export function rejectCampaign(merchantId: string, campaignId: string, reason = 'Rejected by merchant') {
  const db = getDb();
  const c = db.prepare('SELECT * FROM campaigns WHERE id = ? AND merchant_id = ?').get(campaignId, merchantId) as
    { id: string; status: string; opportunity_id: string } | undefined;
  if (!c) throw new Error('campaign not found');
  db.prepare(`UPDATE campaigns SET status='REJECTED' WHERE id=?`).run(campaignId);
  audit({
    merchantId, actor: 'MERCHANT', action: 'CAMPAIGN_REJECTED', severity: 'warn',
    campaignId, opportunityId: c.opportunity_id,
    summary: `Merchant rejected the campaign — ${reason}`, detail: { reason },
  });
  publishRefresh('campaign-rejected');
  return { ok: true };
}
