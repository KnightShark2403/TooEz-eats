import { NextResponse } from 'next/server';
import { rejectCampaign } from '@/agents/orchestrator';
import { MERCHANT_ID } from '@/lib/merchant';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(rejectCampaign(MERCHANT_ID, id, body.reason));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
