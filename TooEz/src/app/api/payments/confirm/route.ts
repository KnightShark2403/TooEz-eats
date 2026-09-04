import { NextResponse } from 'next/server';
import { noteCheckoutReturn } from '@/agents/settlement';
import { MERCHANT_ID } from '@/lib/merchant';

export const dynamic = 'force-dynamic';

/**
 * Called from Razorpay Checkout's success handler.
 *
 * The browser's claim of success is never trusted. This endpoint:
 *   1. verifies the checkout HMAC signature, then
 *   2. asks RAZORPAY directly (server-side, authenticated) whether the payment
 *      actually captured — giving the customer an immediate, authoritative answer.
 *
 * If Razorpay cannot be reached the order stays at AWAITING_CONFIRMATION and the
 * webhook settles it asynchronously. Either way the source of truth is Razorpay,
 * never the client.
 */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = b;
  if (!razorpay_order_id || !razorpay_payment_id) {
    return NextResponse.json({ error: 'missing razorpay ids' }, { status: 400 });
  }
  try {
    const r = await noteCheckoutReturn({
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
