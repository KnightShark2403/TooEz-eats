import { NextResponse } from 'next/server';
import { retryOrder } from '@/agents/settlement';
import { MERCHANT_ID } from '@/lib/merchant';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { orderId } = await req.json().catch(() => ({}));
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });
  try {
    return NextResponse.json(await retryOrder({ merchantId: MERCHANT_ID, orderId }));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
