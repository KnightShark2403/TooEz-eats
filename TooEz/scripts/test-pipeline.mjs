#!/usr/bin/env node
/**
 * End-to-end demo-path test.
 *   Detect -> Offer -> Risk VETO -> Revise -> Risk APPROVE -> Merchant approve
 *   -> Razorpay/mock order -> webhook capture -> dashboard revenue
 * Plus: duplicate-order prevention, webhook replay, and the failure/retry path.
 */
const BASE = process.env.TOOEZ_BASE_URL || 'http://localhost:3000';
const inr = (p) => '₹' + (p / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });

let failures = 0;
const ok = (c, m) => { console.log(`${c ? '  ✓' : '  ✗'} ${m}`); if (!c) failures++; };
const step = (n, t) => console.log(`\n${n}. ${t}`);

const post = async (p, b) => {
  const r = await fetch(BASE + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b ?? {}) });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};
const get = async (p) => (await fetch(BASE + p, { cache: 'no-store' })).json();

console.log('TooEz end-to-end pipeline test →', BASE);

step(0, 'Reset demo dataset');
await post('/api/dev/reset');
let state = await get('/api/state');
ok(state.merchant?.id === 'mrc_campuskitchen', `merchant seeded: ${state.merchant?.name}`);
console.log(`     gateway: ${state.gateway.mode}${state.gateway.testMode ? ' (test)' : ''}, webhook secret ${state.gateway.webhookConfigured ? 'set' : 'absent'}`);
const startRevenue = state.kpis.todayRevenuePaise;

step(1, 'Detection Agent scan');
const scan = await post('/api/scan', {});
ok(scan.json.opportunities?.length > 0, `${scan.json.opportunities?.length ?? 0} opportunities detected`);
for (const o of scan.json.opportunities ?? []) {
  console.log(`     ${o.product_name ?? o.product_id}: ${inr(o.value_at_risk_paise)} recoverable, demand ${o.demand_trend}, ${o.stock_units}u`);
}
for (const s of scan.json.skipped ?? []) console.log(`     skipped ${s.product}: ${s.reason}`);

const hero = (scan.json.opportunities ?? []).sort((a, b) => b.value_at_risk_paise - a.value_at_risk_paise)[0];
if (!hero) { console.log('\nNo opportunity to run. Aborting.'); process.exit(1); }

step(2, 'Offer ⇄ Risk negotiation');
const run = await post('/api/pipeline/run', { opportunityId: hero.id });
const rounds = run.json.rounds ?? [];
for (const r of rounds) {
  const v = r.decision.verdict;
  console.log(`     attempt ${r.offer.attempt}: Offer ${inr(r.offer.offer_price_paise)} (${r.offer.discount_pct.toFixed(1)}% off, ${r.offer.margin_pct.toFixed(1)}% margin) → Risk ${v}`);
  if (v === 'VETOED') for (const c of r.decision.checks.filter((c) => !c.passed))
    console.log(`         ✕ ${c.label}: ${c.observed} vs policy ${c.limit}`);
  if (v === 'VETOED') console.log(`         → constraints returned: ${r.decision.remediation?.note}`);
}
ok(rounds.some((r) => r.decision.verdict === 'VETOED'), 'Risk Agent vetoed at least one offer');
ok(rounds.some((r) => r.decision.verdict === 'APPROVED'), 'Offer Agent produced a compliant revision');
ok(run.json.outcome === 'CAMPAIGN_PENDING_APPROVAL', `outcome: ${run.json.outcome}`);

const vetoed = rounds.find((r) => r.decision.verdict === 'VETOED');
const approved = rounds.find((r) => r.decision.verdict === 'APPROVED');
ok(approved.offer.offer_price_paise > vetoed.offer.offer_price_paise, 'revised price is compliant, not merely higher');

step(3, 'A vetoed price can never reach a campaign');
const campaignId = run.json.campaignId;
let s2 = await get('/api/state');
const campaign = s2.campaigns.find((c) => c.id === campaignId);
ok(campaign.price_paise === approved.offer.offer_price_paise, 'campaign carries the APPROVED price');
ok(campaign.price_paise !== vetoed.offer.offer_price_paise, 'campaign does NOT carry the vetoed price');

step(4, 'Order creation is blocked before merchant approval');
const early = await post('/api/orders/create', { campaignId, idempotencyKey: 'early' });
ok(early.status === 400, `blocked: ${early.json.error}`);

step(5, 'Merchant approves');
const appr = await post(`/api/campaigns/${campaignId}/approve`);
ok(appr.json.ok, 'campaign is LIVE');

step(6, 'Razorpay order creation + idempotency');
const o1 = await post('/api/orders/create', { campaignId, idempotencyKey: 'cust-abc' });
ok(!!o1.json.razorpayOrderId, `order ${o1.json.orderId} → ${o1.json.razorpayOrderId} (${o1.json.gateway})`);
const o2 = await post('/api/orders/create', { campaignId, idempotencyKey: 'cust-abc' });
ok(o2.json.reused === true && o2.json.razorpayOrderId === o1.json.razorpayOrderId,
   'duplicate request returned the SAME Razorpay order (no double charge)');

step(7, 'Frontend cannot mark an order paid');
const beforeConfirm = (await get('/api/state')).orders.find((o) => o.id === o1.json.orderId);
const conf = await post('/api/payments/confirm', {
  razorpay_order_id: o1.json.razorpayOrderId, razorpay_payment_id: 'pay_forged', razorpay_signature: 'not-a-real-signature',
});
const afterConfirm = (await get('/api/state')).orders.find((o) => o.id === o1.json.orderId);
ok(afterConfirm.status !== 'PAID', `order still ${afterConfirm.status} after a forged checkout callback`);

step(8, 'Webhook capture is the only path to PAID');
const cap = await sendWebhook(o1.json.razorpayOrderId, 'captured', o1.json.amountPaise);
ok(cap.result === 'captured', `webhook processed: ${cap.result}`);
let s3 = await get('/api/state');
const paid = s3.orders.find((o) => o.id === o1.json.orderId);
ok(paid.status === 'PAID', 'order is PAID');
ok(s3.kpis.todayRevenuePaise > startRevenue,
   `revenue moved ${inr(startRevenue)} → ${inr(s3.kpis.todayRevenuePaise)} (+${inr(s3.kpis.todayRevenuePaise - startRevenue)})`);

step(9, 'Webhook replay protection');
const replay = await sendWebhook(o1.json.razorpayOrderId, 'captured', o1.json.amountPaise, cap.eventId);
ok(replay.duplicate === true, 'replayed webhook was ignored');
const s4 = await get('/api/state');
ok(s4.kpis.todayRevenuePaise === s3.kpis.todayRevenuePaise, 'revenue did not double-count');

step(10, 'Failure path + retry creates a NEW order');
const f1 = await post('/api/orders/create', { campaignId, idempotencyKey: 'cust-fail' });
await sendWebhook(f1.json.razorpayOrderId, 'failed', f1.json.amountPaise);
let s5 = await get('/api/state');
const failedOrder = s5.orders.find((o) => o.id === f1.json.orderId);
ok(failedOrder.status === 'FAILED', `order marked FAILED: ${failedOrder.failure_reason}`);
const retry = await post('/api/orders/retry', { orderId: f1.json.orderId });
ok(retry.json.orderId !== f1.json.orderId, `retry produced a new order ${retry.json.orderId}`);
await sendWebhook(retry.json.razorpayOrderId, 'captured', retry.json.amountPaise);
let s6 = await get('/api/state');
ok(s6.orders.find((o) => o.id === retry.json.orderId).status === 'PAID', 'retry succeeded');
ok(s6.orders.find((o) => o.id === f1.json.orderId).status === 'FAILED', 'the failed order stayed FAILED');

step(11, 'Learning loop absorbed the outcome');
const learned = s6.learning.find((l) => l.price_paise === campaign.price_paise && l.product_id === campaign.product_id);
ok(learned && learned.conversions >= 2, `${learned?.conversions} conversions now recorded at ${inr(campaign.price_paise)}`);

step(12, 'Audit trail completeness');
const actors = new Set(s6.audit.map((a) => a.actor));
for (const a of ['DETECTION_AGENT', 'OFFER_AGENT', 'RISK_AGENT', 'SETTLEMENT_AGENT', 'MERCHANT', 'RAZORPAY'])
  ok(actors.has(a), `${a} present in the audit log`);
ok(s6.audit.some((a) => a.severity === 'veto'), 'veto is recorded as its own severity');

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);

async function sendWebhook(rzpOrderId, kind, amount, reuseEventId) {
  const crypto = await import('node:crypto');
  const failed = kind === 'failed';
  const payId = `pay_${crypto.randomBytes(7).toString('hex')}`;
  const body = JSON.stringify({
    entity: 'event', event: failed ? 'payment.failed' : 'payment.captured',
    created_at: Math.floor(Date.now() / 1000),
    payload: { payment: { entity: {
      id: payId, entity: 'payment', amount, currency: 'INR',
      status: failed ? 'failed' : 'captured', order_id: rzpOrderId, method: 'upi',
      ...(failed ? { error_code: 'BAD_REQUEST_ERROR', error_description: 'Payment failed — insufficient balance in the customer VPA' } : {}),
    } } },
  });
  const eventId = reuseEventId || `evt_${crypto.randomBytes(8).toString('hex')}`;
  const headers = { 'content-type': 'application/json', 'x-razorpay-event-id': eventId };
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (secret) headers['x-razorpay-signature'] = crypto.createHmac('sha256', secret).update(body).digest('hex');
  else headers['x-tooez-mock-webhook'] = '1';
  const r = await fetch(BASE + '/api/webhooks/razorpay', { method: 'POST', headers, body });
  const j = await r.json();
  return { ...j, eventId };
}
