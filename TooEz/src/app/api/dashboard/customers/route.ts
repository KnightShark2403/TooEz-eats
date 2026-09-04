import { NextResponse } from 'next/server';
import { customers } from '@/lib/dashboard';
import { MERCHANT_ID } from '@/lib/merchant';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const p = new URL(req.url).searchParams;
    const data = customers === undefined ? null : (customers as any)(MERCHANT_ID, {
      search: p.get('q') ?? undefined,
      limit: p.get('limit') ? Number(p.get('limit')) : undefined,
    });
    return NextResponse.json(Array.isArray(data) ? { rows: data, total: data.length } : data,
      { headers: { 'cache-control': 'no-store' } });
  } catch (e: any) {
    log.error('api', 'dashboard/customers failed', { error: e.message });
    return NextResponse.json({ error: 'Could not load customers.' }, { status: 500 });
  }
}
