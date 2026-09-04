import { NextResponse } from 'next/server';
import { runPipeline } from '@/agents/orchestrator';
import { MERCHANT_ID } from '@/lib/merchant';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const { opportunityId } = await req.json();
  if (!opportunityId) return NextResponse.json({ error: 'opportunityId required' }, { status: 400 });
  try {
    const result = await runPipeline(MERCHANT_ID, opportunityId);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
