import { NextResponse } from 'next/server';
import { noteCheckoutReturn } from '@/agents/settlement';
import { MERCHANT_ID } from '@/lib/merchant';

export const dynamic = 'force-dynamic';

/**
 * Called from Razorpay Checkout's success handler.
 *
 * This endpoint verifies the checkout signature but CANNOT mark an order paid.
 * The best outcome it can produce is AWAITING_CONFIRMATION. Revenue is booked
 * only by /api/webhooks/razorpay (or a server-side API reconcile).
 */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = b;
  if (!razorpay_order_id || !razorpay_payment_id) {
    return NextResponse.json({ error: 'missing razorpay ids' }, { status: 400 });
  }
  try {
    const r = noteCheckoutReturn({
      merchantId: MERCHANT_ID,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      signature: razorpay_signature ?? '',
    });
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
