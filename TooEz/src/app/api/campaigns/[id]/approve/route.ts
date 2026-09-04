import { NextResponse } from 'next/server';
import { approveCampaign } from '@/agents/orchestrator';
import { MERCHANT_ID } from '@/lib/merchant';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    return NextResponse.json(approveCampaign(MERCHANT_ID, id));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
