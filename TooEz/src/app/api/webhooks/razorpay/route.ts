import { NextResponse } from 'next/server';
import { processWebhook } from '@/agents/settlement';
import { MERCHANT_ID } from '@/lib/merchant';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Razorpay webhook receiver — the single source of truth for payment success.
 *
 * The RAW body text is read before any parsing, because the HMAC is computed
 * over the exact bytes Razorpay sent. Parsing first and re-serialising would
 * silently break signature verification.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get('x-razorpay-signature');
  const eventId = req.headers.get('x-razorpay-event-id');

  // When no Razorpay keys are configured the app runs on the mock gateway.
  // In that mode only an explicit local mock header is accepted, so this
  // endpoint can never be spoofed into booking revenue in a real deployment.
  const allowMock = req.headers.get('x-tooez-mock-webhook') === '1';

  const r = processWebhook({
    merchantId: MERCHANT_ID, rawBody: raw, signature, eventIdHeader: eventId, allowMock,
  });
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
