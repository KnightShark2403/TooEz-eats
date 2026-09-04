import { NextResponse } from 'next/server';
import { overview, revenueSeries, orders, products, analytics, type Range } from '@/lib/dashboard';
import { MERCHANT_ID } from '@/lib/merchant';
import { getDb } from '@/lib/db';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const RANGES: Range[] = ['today', '7d', '30d', '90d'];

/** One call powers the Overview page — KPIs, chart, status ring, recent rows. */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const raw = url.searchParams.get('range') as Range | null;
    const range: Range = raw && RANGES.includes(raw) ? raw : '7d';

    const merchant = getDb().prepare('SELECT * FROM merchants WHERE id = ?').get(MERCHANT_ID);
    if (!merchant) return NextResponse.json({ error: 'merchant not provisioned' }, { status: 503 });

    const a = analytics(MERCHANT_ID, range);
    return NextResponse.json({
      merchant,
      ...overview(MERCHANT_ID, range),
      series: revenueSeries(MERCHANT_ID, range),
      orderStatus: a.orderStatus,
      averageOrderValuePaise: a.averageOrderValuePaise,
      recent: orders(MERCHANT_ID, { limit: 8 }).rows,
      topProducts: products(MERCHANT_ID).slice(0, 5),
      agentImpact: a.agentImpact,
    }, { headers: { 'cache-control': 'no-store' } });
  } catch (e: any) {
    log.error('api', 'dashboard/overview failed', { error: e.message });
    return NextResponse.json({ error: 'Could not load the overview.' }, { status: 500 });
  }
}
