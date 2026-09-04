import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { gatewayMode } from '@/lib/razorpay';
import { processWebhook } from '@/agents/settlement';
import { MERCHANT_ID } from '@/lib/merchant';

export const dynamic = 'force-dynamic';

/**
 * LOCAL MOCK GATEWAY — development only.
 *
 * Active ONLY when no Razorpay keys are configured (gatewayMode() === 'mock').
 * With real keys present this endpoint refuses to run, so it can never be used
 * to fabricate a payment against a real integration.
 *
 * It does not shortcut the architecture: it emits a webhook payload shaped
 * exactly like Razorpay's and pushes it through the same processWebhook() code
 * path the real webhook uses. The browser still cannot mark anything paid.
 */
export async function POST(req: Request) {
  if (gatewayMode() !== 'mock') {
    return NextResponse.json(
      { error: 'Razorpay keys are configured — the mock gateway is disabled. Use real Checkout.' },
      { status: 403 }
    );
  }
  const { razorpayOrderId, outcome } = await req.json().catch(() => ({}));
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE razorpay_order_id = ?').get(razorpayOrderId) as any;
  if (!order) return NextResponse.json({ error: 'unknown order' }, { status: 404 });

  const payId = `mock_pay_${Math.random().toString(36).slice(2, 12)}`;
  const failed = outcome === 'fail';
  const payload = {
    entity: 'event',
    event: failed ? 'payment.failed' : 'payment.captured',
    created_at: Math.floor(Date.now() / 1000),
    payload: {
      payment: {
        entity: {
          id: payId,
          entity: 'payment',
          amount: order.amount_paise,
          currency: 'INR',
          status: failed ? 'failed' : 'captured',
          order_id: razorpayOrderId,
          method: 'upi',
          ...(failed
            ? { error_code: 'BAD_REQUEST_ERROR', error_description: 'Payment failed — insufficient balance in the customer VPA', error_step: 'payment_authentication' }
            : {}),
        },
      },
    },
  };

  // Sign the payload if a webhook secret exists, so even the mock path exercises
  // the same HMAC verification Razorpay's real deliveries go through.
  const raw = JSON.stringify(payload);
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const r = processWebhook({
    merchantId: MERCHANT_ID,
    rawBody: raw,
    signature: secret ? crypto.createHmac('sha256', secret).update(raw).digest('hex') : null,
    eventIdHeader: `mock_evt_${payId}`,
    allowMock: true,
  });
  return NextResponse.json({ ...r, paymentId: payId, mock: true });
}
