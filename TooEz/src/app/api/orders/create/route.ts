import { NextResponse } from 'next/server';
import { createOrderForCampaign } from '@/agents/settlement';
import { MERCHANT_ID } from '@/lib/merchant';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { campaignId, idempotencyKey, customerRef } = body;
  if (!campaignId || !idempotencyKey) {
    return NextResponse.json({ error: 'campaignId and idempotencyKey are required' }, { status: 400 });
  }
  try {
    const r = await createOrderForCampaign({ merchantId: MERCHANT_ID, campaignId, idempotencyKey, customerRef });
    return NextResponse.json(r);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
