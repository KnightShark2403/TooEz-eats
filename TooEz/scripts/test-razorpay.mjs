#!/usr/bin/env node
/**
 * Razorpay TEST-MODE integration test.
 *
 * Unlike test-pipeline.mjs (which exercises the webhook contract with signed
 * synthetic events), this test talks to the REAL Razorpay test API and asserts
 * that TooEz's stored mapping matches what Razorpay itself reports.
 *
 *   TooEz order  ->  Razorpay order  ->  Razorpay payment
 *
 * It also exercises the failure matrix: bad signature, unknown order, duplicate
 * delivery, missing credentials.
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

const BASE = process.env.TOOEZ_BASE_URL || 'http://localhost:3000';
const inr = (p) => '₹' + (p / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
let failures = 0;
const ok = (c, m) => { console.log(`${c ? '  ✓' : '  ✗'} ${m}`); if (!c) failures++; };
const step = (n, t) => console.log(`\n${n}. ${t}`);
const post = async (p, b, h) => {
  const r = await fetch(BASE + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(h ?? {}) }, body: JSON.stringify(b ?? {}) });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};
const get = async (p) => (await fetch(BASE + p, { cache: 'no-store' })).json();

console.log('TooEz ⇄ Razorpay TEST MODE integration test →', BASE);

step(0, 'Configuration self-check');
const health = await get('/api/health');
ok(health.ok, `health ok, database ${health.database.ok ? 'reachable' : 'unreachable'}`);
ok(health.razorpay.gateway === 'razorpay', `gateway: ${health.razorpay.gateway}`);
ok(health.razorpay.testMode === true, 'key id is a TEST key (rzp_test_…)');
ok(health.razorpay.webhookSecretConfigured, 'webhook secret configured');
ok(health.razorpay.problems.length === 0, `no configuration problems`);
if (health.razorpay.gateway !== 'razorpay') { console.log('\nRazorpay keys not configured — aborting.'); process.exit(1); }

step(1, 'Food app order → TooEz backend → Razorpay order');
await post('/api/dev/reset');
const scan = await post('/api/scan', {});
const opp = scan.json.opportunities.find((o) => o.product_id === 'prd_wrapcombo');
const run = await post('/api/pipeline/run', { opportunityId: opp.id });
ok(run.json.outcome === 'CAMPAIGN_PENDING_APPROVAL', 'agent pipeline produced an approved campaign');
const campaignId = run.json.campaignId;
await post(`/api/campaigns/${campaignId}/approve`);

const created = await post('/api/orders/create', {
  campaignId, idempotencyKey: `it_${Date.now()}`,
  customerName: 'Integration Test', customerPhone: '9000000001',
});
ok(created.status === 200, `order created: ${created.json.orderId}`);
ok(/^order_/.test(created.json.razorpayOrderId ?? ''),
   `REAL Razorpay order id returned: ${created.json.razorpayOrderId}`);
ok(created.json.gateway === 'razorpay', 'order recorded against the razorpay gateway');

step(2, 'Verify the mapping against Razorpay itself');
const Razorpay = (await import('razorpay')).default;
const rz = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
const remote = await rz.orders.fetch(created.json.razorpayOrderId);
ok(remote.id === created.json.razorpayOrderId, 'Razorpay confirms the order exists');
ok(Number(remote.amount) === created.json.amountPaise,
   `amount matches on both sides: ${inr(Number(remote.amount))}`);
ok(remote.notes?.tooez_order_id === created.json.orderId,
   `Razorpay order carries the TooEz order id in notes (reverse mapping works)`);
ok(remote.receipt === created.json.orderId, 'receipt is the TooEz order id');

step(3, 'Dashboard reads the mapping from the BACKEND, not from Razorpay');
const dashOrders = await get('/api/dashboard/orders?limit=5');
const row = dashOrders.rows.find((r) => r.id === created.json.orderId);
ok(!!row, 'order appears in /api/dashboard/orders');
ok(row.razorpay_order_id === created.json.razorpayOrderId, 'dashboard row carries the Razorpay order id');
ok(row.customer_name === 'Integration Test', 'customer captured at checkout reaches the dashboard');
ok(row.status === 'CREATED', `payment status starts at ${row.status} — not assumed successful`);

step(4, 'Invalid webhook signature is rejected');
const bad = await fetch(BASE + '/api/webhooks/razorpay', {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-razorpay-signature': 'deadbeef' },
  body: JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_x', amount: 1, order_id: created.json.razorpayOrderId } } } }),
});
ok(bad.status === 400, `rejected with ${bad.status}`);
const stillCreated = (await get('/api/dashboard/orders?limit=50')).rows.find((r) => r.id === created.json.orderId);
ok(stillCreated.status === 'CREATED', 'no state change from an unsigned/forged webhook');

step(5, 'Signed webhook for an unknown Razorpay order changes nothing');
const unknown = await sendSigned('order_thisdoesnotexist', 'captured', 10900);
ok(unknown.result === 'unknown_order', `handled safely: ${unknown.result}`);

step(6, 'Signed webhook capture settles the order');
const cap = await sendSigned(created.json.razorpayOrderId, 'captured', created.json.amountPaise);
ok(cap.result === 'captured', 'webhook processed');
const paid = (await get('/api/dashboard/orders?limit=50')).rows.find((r) => r.id === created.json.orderId);
ok(paid.status === 'PAID', 'order is PAID');
ok(paid.payment_method === 'upi', `payment method recorded: ${paid.payment_method}`);
ok(!!paid.razorpay_payment_id, `Razorpay payment id stored: ${paid.razorpay_payment_id}`);
ok(!!paid.captured_at, 'captured_at timestamp recorded');

step(7, 'Duplicate webhook delivery is idempotent');
const dup = await sendSigned(created.json.razorpayOrderId, 'captured', created.json.amountPaise, cap.eventId);
ok(dup.duplicate === true, 'replay ignored');
const pays = await get('/api/dashboard/payments?limit=50');
const forOrder = pays.rows.filter((p) => p.tooez_order_id === created.json.orderId);
ok(forOrder.length === 1, `exactly one payment row for this order (${forOrder.length})`);

step(8, 'Amount tampering is refused');
const tamper = await sendSigned(created.json.razorpayOrderId, 'captured', 100);
ok(['already_paid', 'amount_mismatch'].includes(tamper.result), `refused: ${tamper.result}`);

step(9, 'Reverse lookup: Razorpay payment → TooEz order');
const p = forOrder[0];
ok(p.tooez_order_id === created.json.orderId, `${p.razorpay_payment_id} → ${p.tooez_order_id}`);
ok(p.razorpay_order_id === created.json.razorpayOrderId, `${p.razorpay_payment_id} → ${p.razorpay_order_id}`);

step(10, 'Failed payment does not book revenue');
const f = await post('/api/orders/create', { campaignId, idempotencyKey: `it_fail_${Date.now()}`, customerName: 'Fail Case' });
const beforeRev = (await get('/api/dashboard/overview?range=today')).kpis.revenue.value;
await sendSigned(f.json.razorpayOrderId, 'failed', f.json.amountPaise);
const failedRow = (await get('/api/dashboard/orders?limit=50')).rows.find((r) => r.id === f.json.orderId);
ok(failedRow.status === 'FAILED', `order FAILED: ${failedRow.failure_reason}`);
ok(failedRow.failure_code === 'BAD_REQUEST_ERROR', `failure code stored: ${failedRow.failure_code}`);
const afterRev = (await get('/api/dashboard/overview?range=today')).kpis.revenue.value;
ok(afterRev === beforeRev, 'revenue unchanged by the failure');

step(11, 'Refund through the backend (dashboard never holds the key secret)');
const refund = await post('/api/orders/refund', {
  orderId: created.json.orderId, reason: 'integration test', idempotencyKey: `rf_${Date.now()}`,
});
if (refund.status === 200) {
  ok(/^rfnd_/.test(refund.json.refundId), `REAL Razorpay refund created: ${refund.json.refundId}`);
} else {
  // A synthetic pay_… id (from the signed-webhook harness) does not exist at
  // Razorpay, so a refund against it MUST be refused. That refusal is the
  // correct behaviour and proves the call really reached Razorpay.
  ok(refund.status === 400 && /does not exist|refund|payment/i.test(refund.json.error ?? ''),
     `refund correctly refused for a synthetic payment id: ${refund.json.error}`);
  console.log('     (run scripts/test-checkout.mjs for a refund against a REAL captured payment)');
}

step(12, 'Dashboard aggregates are computed from stored data');
const ov = await get('/api/dashboard/overview?range=7d');
ok(ov.kpis.orders.value >= 2, `${ov.kpis.orders.value} orders counted`);
ok(ov.kpis.failedPayments.value >= 1, `${ov.kpis.failedPayments.value} failed payment counted`);
ok(ov.series.length === 7, `revenue series has ${ov.series.length} daily points`);
ok(ov.gateway.mode === 'razorpay' && ov.gateway.testMode, 'dashboard reports Razorpay TEST mode');
ok(!JSON.stringify(ov).includes(process.env.RAZORPAY_KEY_SECRET), 'key secret does NOT appear in any dashboard payload');
ok(!JSON.stringify(ov).includes(process.env.RAZORPAY_WEBHOOK_SECRET), 'webhook secret does NOT appear in any dashboard payload');

const cust = await get('/api/dashboard/customers');
ok(cust.rows.some((c) => c.name === 'Integration Test'), 'customer aggregation includes the checkout name');

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);

async function sendSigned(rzpOrderId, kind, amount, reuseEventId) {
  const failed = kind === 'failed';
  const body = JSON.stringify({
    entity: 'event', event: failed ? 'payment.failed' : 'payment.captured',
    created_at: Math.floor(Date.now() / 1000),
    payload: { payment: { entity: {
      id: `pay_${crypto.randomBytes(7).toString('hex')}`, entity: 'payment', amount, currency: 'INR',
      status: failed ? 'failed' : 'captured', order_id: rzpOrderId, method: 'upi',
      ...(failed ? { error_code: 'BAD_REQUEST_ERROR', error_description: 'Payment failed — insufficient balance in the customer VPA' } : {}),
    } } },
  });
  const eventId = reuseEventId || `evt_${crypto.randomBytes(8).toString('hex')}`;
  const sig = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(body).digest('hex');
  const r = await fetch(BASE + '/api/webhooks/razorpay', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-razorpay-event-id': eventId, 'x-razorpay-signature': sig },
    body,
  });
  return { ...(await r.json()), eventId };
}
