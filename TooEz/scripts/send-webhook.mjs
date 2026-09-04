#!/usr/bin/env node
/**
 * Sends a REAL, correctly-signed Razorpay webhook to the local app.
 *
 * This is not a bypass: the payload is signed with RAZORPAY_WEBHOOK_SECRET
 * using the exact HMAC-SHA256-over-raw-body scheme Razorpay uses, and the app
 * verifies it with the same code that verifies Razorpay's own deliveries.
 * Use it to demo the webhook path when you cannot expose a public URL.
 *
 *   node scripts/send-webhook.mjs <razorpay_order_id> [captured|failed] [amountPaise]
 */
import crypto from 'node:crypto';
import fs from 'node:fs';

for (const f of ['.env.local', '.env']) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const [orderId, kind = 'captured', amountArg] = process.argv.slice(2);
if (!orderId) {
  console.error('usage: node scripts/send-webhook.mjs <razorpay_order_id> [captured|failed] [amountPaise]');
  process.exit(1);
}
const base = process.env.TOOEZ_BASE_URL || 'http://localhost:3000';
const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
const amount = Number(amountArg || 10900);
const failed = kind === 'failed';
const payId = `pay_${crypto.randomBytes(7).toString('hex')}`;

const body = JSON.stringify({
  entity: 'event',
  event: failed ? 'payment.failed' : 'payment.captured',
  contains: ['payment'],
  created_at: Math.floor(Date.now() / 1000),
  payload: {
    payment: {
      entity: {
        id: payId, entity: 'payment', amount, currency: 'INR',
        status: failed ? 'failed' : 'captured', order_id: orderId, method: 'upi',
        ...(failed ? {
          error_code: 'BAD_REQUEST_ERROR',
          error_description: 'Payment failed — insufficient balance in the customer VPA',
          error_step: 'payment_authentication',
        } : {}),
      },
    },
  },
});

const headers = { 'content-type': 'application/json', 'x-razorpay-event-id': `evt_${crypto.randomBytes(8).toString('hex')}` };
if (secret) {
  headers['x-razorpay-signature'] = crypto.createHmac('sha256', secret).update(body).digest('hex');
} else {
  headers['x-tooez-mock-webhook'] = '1';
  console.log('! RAZORPAY_WEBHOOK_SECRET not set — sending on the mock-gateway path instead.');
}

const r = await fetch(`${base}/api/webhooks/razorpay`, { method: 'POST', headers, body });
console.log(r.status, await r.text());
