import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { audit } from '@/lib/audit';
import { publishRefresh } from '@/lib/events';
import { MERCHANT_ID } from '@/lib/merchant';
import { getPolicies } from '@/agents/risk';

export const dynamic = 'force-dynamic';

const NUMERIC = [
  'min_margin_pct', 'max_discount_pct', 'daily_discount_budget_paise',
  'max_campaign_exposure_paise', 'max_active_campaigns', 'cannibalization_window_min',
  'require_merchant_approval',
] as const;

export async function GET() {
  return NextResponse.json(getPolicies(MERCHANT_ID));
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const updates: Record<string, number> = {};
  for (const k of NUMERIC) if (typeof body[k] === 'number') updates[k] = body[k];
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'no valid fields' }, { status: 400 });

  const before = getPolicies(MERCHANT_ID);
  const sets = Object.keys(updates).map((k) => `${k} = @${k}`).join(', ');
  getDb().prepare(`UPDATE policies SET ${sets}, updated_at = datetime('now') WHERE merchant_id = @m`)
    .run({ ...updates, m: MERCHANT_ID });

  audit({
    merchantId: MERCHANT_ID, actor: 'MERCHANT', action: 'POLICY_UPDATED', severity: 'warn',
    summary: `Guardrails changed: ${Object.entries(updates).map(([k, v]) => `${k} → ${v}`).join(', ')}`,
    detail: { before, updates },
  });
  publishRefresh('policy');
  return NextResponse.json(getPolicies(MERCHANT_ID));
}
