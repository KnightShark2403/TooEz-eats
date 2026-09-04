import crypto from 'node:crypto';
import Razorpay from 'razorpay';

/**
 * Razorpay adapter.
 *
 * Two modes, and the mode is always visible in the UI and stamped on every
 * order row (`orders.gateway`) and audit entry:
 *
 *   'razorpay' — real Razorpay TEST-mode API calls with your rzp_test_ keys.
 *   'mock'     — a clearly-labelled local adapter used ONLY when no keys are
 *                configured, so the agent pipeline can still be developed and
 *                demoed offline. It never claims to be Razorpay, it produces
 *                mock_order_/mock_pay_ ids, and the dashboard renders a
 *                "MOCK GATEWAY" badge whenever it is in use.
 *
 * Nothing in the mock path is presented as a real integration.
 */

export type Gateway = 'razorpay' | 'mock';

export function gatewayMode(): Gateway {
  return process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET ? 'razorpay' : 'mock';
}

export function publicKeyId(): string | null {
  return process.env.RAZORPAY_KEY_ID ?? null;
}

export function isTestMode(): boolean {
  return (process.env.RAZORPAY_KEY_ID ?? '').startsWith('rzp_test_');
}

let _client: Razorpay | null = null;
export function client(): Razorpay {
  if (gatewayMode() !== 'razorpay') throw new Error('Razorpay keys not configured');
  if (!_client) {
    _client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
  }
  return _client;
}

export interface CreatedOrder { id: string; amount: number; currency: string; status: string; gateway: Gateway }

/** Razorpay SDK errors are plain objects, not Errors — surface something readable. */
export function describeError(e: any): string {
  const d = e?.error?.description ?? e?.description ?? e?.message;
  const code = e?.error?.code ?? e?.statusCode;
  if (d) return `Razorpay: ${d}${code ? ` (${code})` : ''}`;
  try { return `Razorpay: ${JSON.stringify(e).slice(0, 300)}`; } catch { return 'Razorpay: unknown error'; }
}

export async function createOrder(args: {
  amountPaise: number; receipt: string; notes: Record<string, string>;
}): Promise<CreatedOrder> {
  if (gatewayMode() === 'mock') {
    return {
      id: `mock_order_${crypto.randomBytes(8).toString('hex')}`,
      amount: args.amountPaise, currency: 'INR', status: 'created', gateway: 'mock',
    };
  }
  let o;
  try {
    o = await client().orders.create({
      amount: args.amountPaise,           // Razorpay speaks paise, same unit we store.
      currency: 'INR',
      receipt: args.receipt.slice(0, 40), // Razorpay caps receipt at 40 chars.
      notes: args.notes,
      payment_capture: true,
    });
  } catch (e) {
    throw new Error(describeError(e));
  }
  return { id: o.id, amount: Number(o.amount), currency: o.currency, status: o.status, gateway: 'razorpay' };
}

/** Signature returned by Checkout's success handler: HMAC(order_id|payment_id). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  return timingSafeEqual(expected, signature);
}

/** Webhook signature: HMAC-SHA256 over the RAW request body with the webhook secret. */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return timingSafeEqual(expected, signature);
}

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/** Server-side reconciliation. The other acceptable source of payment truth. */
export async function fetchPayment(paymentId: string) {
  return client().payments.fetch(paymentId);
}

export async function fetchOrderPayments(orderId: string) {
  return client().orders.fetchPayments(orderId);
}
