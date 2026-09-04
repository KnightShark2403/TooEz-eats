import { NextResponse } from 'next/server';
import { refundOrder } from '@/agents/settlement';
import { MERCHANT_ID } from '@/lib/merchant';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Dashboard → backend → Razorpay. The browser never holds the key secret;
 * it asks the server to perform the privileged refund call.
 */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const { orderId, amountPaise, reason, idempotencyKey } = b;
  if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
  try {
    const r = await refundOrder({
      merchantId: MERCHANT_ID, orderId,
      amountPaise: typeof amountPaise === 'number' ? amountPaise : undefined,
      reason: typeof reason === 'string' ? reason.slice(0, 200) : undefined,
      idempotencyKey: typeof idempotencyKey === 'string' && idempotencyKey ? idempotencyKey : `rf_${orderId}`,
    });
    return NextResponse.json(r);
  } catch (e: any) {
    log.warn('api', 'refund rejected', { orderId, error: e.message });
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
