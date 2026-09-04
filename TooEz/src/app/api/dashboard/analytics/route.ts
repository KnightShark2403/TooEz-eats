import { NextResponse } from 'next/server';
import { analytics, type Range } from '@/lib/dashboard';
import { MERCHANT_ID } from '@/lib/merchant';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const r = (new URL(req.url).searchParams.get('range') ?? '30d') as Range;
    return NextResponse.json(analytics(MERCHANT_ID, r), { headers: { 'cache-control': 'no-store' } });
  } catch (e: any) {
    log.error('api', 'dashboard/analytics failed', { error: e.message });
    return NextResponse.json({ error: 'Could not load analytics.' }, { status: 500 });
  }
}
