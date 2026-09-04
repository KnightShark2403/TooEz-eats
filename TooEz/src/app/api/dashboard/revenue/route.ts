import { NextResponse } from 'next/server';
import { revenueSeries, type Range } from '@/lib/dashboard';
import { MERCHANT_ID } from '@/lib/merchant';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const r = (new URL(req.url).searchParams.get('range') ?? '7d') as Range;
    return NextResponse.json({ series: revenueSeries(MERCHANT_ID, r) }, { headers: { 'cache-control': 'no-store' } });
  } catch (e: any) {
    log.error('api', 'dashboard/revenue failed', { error: e.message });
    return NextResponse.json({ error: 'Could not load revenue.' }, { status: 500 });
  }
}
