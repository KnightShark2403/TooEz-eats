import { NextResponse } from 'next/server';
import { payments } from '@/lib/dashboard';
import { MERCHANT_ID } from '@/lib/merchant';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const p = new URL(req.url).searchParams;
    return NextResponse.json(
      payments(MERCHANT_ID, {
        status: p.get('status') ?? undefined,
        search: p.get('q') ?? undefined,
        limit: p.get('limit') ? Number(p.get('limit')) : undefined,
        offset: p.get('offset') ? Number(p.get('offset')) : undefined,
      }),
      { headers: { 'cache-control': 'no-store' } }
    );
  } catch (e: any) {
    log.error('api', 'dashboard/payments failed', { error: e.message });
    return NextResponse.json({ error: 'Could not load payments.' }, { status: 500 });
  }
}
