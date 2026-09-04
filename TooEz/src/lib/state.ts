import { getDb } from './db';
import { publicGatewayInfo } from './env';
import { discountSpentToday, getPolicies, activeCampaignCount } from '@/agents/risk';
import { buildLadder } from '@/agents/pricing-model';
import type { Product } from '@/agents/types';

export function dashboardState(merchantId: string) {
  const db = getDb();
  const merchant = db.prepare('SELECT * FROM merchants WHERE id = ?').get(merchantId);
  const policies = getPolicies(merchantId);
  const products = db.prepare('SELECT * FROM products WHERE merchant_id = ? ORDER BY name').all(merchantId) as Product[];

  const organic = db.prepare(
    `SELECT COALESCE(SUM(units * unit_price_paise),0) AS r FROM organic_sales
      WHERE merchant_id = ? AND date(sold_at) = date('now','localtime')`
  ).get(merchantId) as { r: number };

  const agentRevenue = db.prepare(
    `SELECT COALESCE(SUM(revenue_paise),0) AS r FROM campaigns
      WHERE merchant_id = ? AND date(created_at) = date('now','localtime')`
  ).get(merchantId) as { r: number };

  const opportunities = db.prepare(
    `SELECT o.*, p.name AS product_name, p.sku, p.list_price_paise, p.cogs_paise, p.stock_units
       FROM opportunities o JOIN products p ON p.id = o.product_id
      WHERE o.merchant_id = ? AND o.status = 'OPEN'
      ORDER BY o.value_at_risk_paise DESC`
  ).all(merchantId) as any[];

  const projected = opportunities.reduce((s, o) => s + o.value_at_risk_paise, 0);

  const campaigns = db.prepare(
    `SELECT c.*, p.name AS product_name, p.list_price_paise, p.cogs_paise,
            o.reasoning, o.strategy, o.expected_conversions, o.expected_revenue_paise, o.discount_pct, o.margin_pct
       FROM campaigns c
       JOIN products p ON p.id = c.product_id
       JOIN offers o   ON o.id = c.offer_id
      WHERE c.merchant_id = ?
      ORDER BY c.created_at DESC LIMIT 12`
  ).all(merchantId) as any[];

  const orders = db.prepare(
    `SELECT o.*, c.price_paise AS campaign_price, p.name AS product_name
       FROM orders o
       JOIN campaigns c ON c.id = o.campaign_id
       JOIN products  p ON p.id = c.product_id
      WHERE o.merchant_id = ?
      ORDER BY o.created_at DESC LIMIT 15`
  ).all(merchantId) as any[];

  const audit = db.prepare(
    'SELECT * FROM audit_log WHERE merchant_id = ? ORDER BY id DESC LIMIT 60'
  ).all(merchantId) as any[];

  const learning = db.prepare(
    `SELECT oo.*, p.name AS product_name, p.list_price_paise
       FROM offer_outcomes oo JOIN products p ON p.id = oo.product_id
      WHERE oo.merchant_id = ?
      ORDER BY p.name, oo.price_paise DESC`
  ).all(merchantId) as any[];

  const spent = discountSpentToday(merchantId);

  return {
    merchant,
    policies,
    gateway: publicGatewayInfo(),
    kpis: {
      todayRevenuePaise: organic.r + agentRevenue.r,
      organicRevenuePaise: organic.r,
      agentRevenuePaise: agentRevenue.r,
      projectedRecoverablePaise: projected,
      openOpportunities: opportunities.length,
      activeCampaigns: activeCampaignCount(merchantId),
      discountSpentPaise: spent,
      discountBudgetPaise: policies.daily_discount_budget_paise,
    },
    products,
    opportunities,
    campaigns,
    orders,
    audit,
    learning,
  };
}

export function opportunityDetail(merchantId: string, opportunityId: string) {
  const db = getDb();
  const opp = db.prepare(
    `SELECT o.*, p.name AS product_name, p.sku, p.list_price_paise, p.cogs_paise, p.stock_units, p.perishable
       FROM opportunities o JOIN products p ON p.id = o.product_id
      WHERE o.id = ? AND o.merchant_id = ?`
  ).get(opportunityId, merchantId) as any;
  if (!opp) return null;

  const offers = db.prepare('SELECT * FROM offers WHERE opportunity_id = ? ORDER BY attempt ASC').all(opportunityId) as any[];
  const decisions = db.prepare('SELECT * FROM risk_decisions WHERE opportunity_id = ?').all(opportunityId) as any[];
  const byOffer = new Map(decisions.map((d) => [d.offer_id, d]));
  const campaign = db.prepare('SELECT * FROM campaigns WHERE opportunity_id = ?').get(opportunityId) as any;
  const timeline = db.prepare('SELECT * FROM audit_log WHERE opportunity_id = ? ORDER BY id ASC').all(opportunityId) as any[];

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(opp.product_id) as Product;
  const signals = JSON.parse(opp.signals_json || '{}');
  const ladder = buildLadder(product, signals.audienceEstimate ?? 40, product.stock_units);

  return {
    opportunity: opp,
    signals,
    ladder,
    rounds: offers.map((o) => ({
      offer: o,
      decision: byOffer.get(o.id)
        ? { ...byOffer.get(o.id), checks: JSON.parse(byOffer.get(o.id).checks_json),
            remediation: byOffer.get(o.id).remediation_json ? JSON.parse(byOffer.get(o.id).remediation_json) : null }
        : null,
    })),
    campaign,
    timeline,
  };
}
