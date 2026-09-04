export type DemandTrend = 'FALLING' | 'FLAT' | 'RISING';
export type RiskVerdict = 'APPROVED' | 'VETOED';

export interface Product {
  id: string; merchant_id: string; sku: string; name: string; category: string;
  list_price_paise: number; cogs_paise: number; perishable: number;
  shelf_life_min: number; stock_units: number; produced_at: string | null;
}

export interface Policies {
  merchant_id: string;
  min_margin_pct: number;
  max_discount_pct: number;
  daily_discount_budget_paise: number;
  max_campaign_exposure_paise: number;
  max_active_campaigns: number;
  cannibalization_window_min: number;
  require_merchant_approval: number;
}

export interface DetectionSignals {
  hourOfDay: number;
  windowMinutes: number;
  stockUnits: number;
  avgUnitsThisHour: number;
  avgUnitsNextHour: number;
  demandTrend: DemandTrend;
  demandIndex: number;          // this hour vs the SKU's daily peak, 0..1
  audienceEstimate: number;     // forecast impressions in the window
  baselineUnits: number;        // units expected to sell at list price in the window
  baselineRevenuePaise: number;
  expectedWasteUnits: number;
  inventoryAtRiskPaise: number; // list value of stock forecast to go unsold
  historicalSellThroughPct: number;
  minutesOfShelfLifeLeft: number | null;
  bestUnconstrainedPricePaise: number;
  bestUnconstrainedRevenuePaise: number;
  recoverablePaise: number;     // headline opportunity = best achievable - baseline
}

export interface Opportunity {
  id: string; merchant_id: string; product_id: string; detected_at: string;
  window_minutes: number; stock_units: number; baseline_units: number;
  expected_waste: number; sell_through_pct: number; demand_trend: DemandTrend;
  demand_index: number; value_at_risk_paise: number; status: string;
  rationale: string; signals_json: string;
}

export interface OfferConstraints {
  minPricePaise?: number;
  maxUnits?: number;
  maxExposurePaise?: number;
  excludePrices?: number[];
  note?: string;
}

export interface OfferProposal {
  id: string; opportunity_id: string; attempt: number;
  offer_price_paise: number; bundle_label: string; discount_pct: number;
  expected_conversions: number; expected_revenue_paise: number;
  expected_margin_paise: number; margin_pct: number; units_offered: number;
  strategy: 'LEARNED' | 'EXPLORE' | 'CONSTRAINT_REPAIR';
  reasoning: string; reasoning_source: 'deterministic' | 'llm';
  ladder: PricePoint[];
}

export interface PricePoint {
  price_paise: number;
  discount_pct: number;
  conversion_rate: number;
  observed_impressions: number;
  observed_conversions: number;
  source: 'observed' | 'prior' | 'blended';
  expected_conversions: number;
  expected_revenue_paise: number;
  margin_pct: number;
}

export interface RiskCheck {
  rule: string;
  label: string;
  passed: boolean;
  observed: string;
  limit: string;
  detail: string;
}

export interface RiskDecision {
  id: string; offer_id: string; opportunity_id: string;
  verdict: RiskVerdict;
  checks: RiskCheck[];
  violatedRules: string[];
  primaryReason: string;
  remediation: OfferConstraints | null;
}
