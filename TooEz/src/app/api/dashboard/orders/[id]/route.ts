import { NextResponse } from 'next/server';
import { orderDetail } from '@/lib/dashboard';
import { MERCHANT_ID } from '@/lib/merchant';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const d = orderDetail(MERCHANT_ID, id);
  if (!d) return NextResponse.json({ error: 'order not found' }, { status: 404 });
  return NextResponse.json(d, { headers: { 'cache-control': 'no-store' } });
}
