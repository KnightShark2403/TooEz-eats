import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { gatewayMode, isTestMode, publicKeyId } from '@/lib/razorpay';
import { MERCHANT_ID } from '@/lib/merchant';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await ctx.params;
  const db = getDb();
  const c = db.prepare(
    `SELECT c.id, c.status, c.price_paise, c.units_offered, c.units_sold, c.expires_at,
            p.name AS product_name, p.category, p.list_price_paise,
            m.name AS merchant_name,
            o.window_minutes
       FROM campaigns c
       JOIN products p    ON p.id = c.product_id
       JOIN merchants m   ON m.id = c.merchant_id
       JOIN opportunities o ON o.id = c.opportunity_id
      WHERE c.id = ? AND c.merchant_id = ?`
  ).get(campaignId, MERCHANT_ID) as any;

  if (!c) return NextResponse.json({ error: 'not found' }, { status: 404 });

  return NextResponse.json({
    campaign: c,
    remaining: Math.max(0, c.units_offered - c.units_sold),
    gateway: { mode: gatewayMode(), testMode: isTestMode(), keyId: publicKeyId() },
  }, { headers: { 'cache-control': 'no-store' } });
}
