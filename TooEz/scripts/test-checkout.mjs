#!/usr/bin/env node
/**
 * FULL end-to-end test through the REAL Razorpay test Checkout.
 *
 * Drives a real browser: food app → Buy now → Razorpay Checkout → UPI
 * success@razorpay → payment captured at Razorpay → TooEz settles the order via
 * server-side API reconciliation (the same code path the webhook uses) → the
 * dashboard reflects it → a REAL refund is issued against the REAL payment.
 *
 * Requires: RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in .env.local, the app on
 * :3000, and a browser. Set PLAYWRIGHT_CHROMIUM to override the binary path.
 */
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
const post = async (p, b) => {
  const r = await fetch(BASE + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b ?? {}) });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};
const get = async (p) => (await fetch(BASE + p, { cache: 'no-store' })).json();

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

console.log('TooEz full-stack checkout test (REAL Razorpay test mode) →', BASE);

step(0, 'Prepare a live campaign through the agents');
await post('/api/dev/reset');
const scan = await post('/api/scan', {});
const opp = scan.json.opportunities.find((o) => o.product_id === 'prd_wrapcombo');
const run = await post('/api/pipeline/run', { opportunityId: opp.id });
const campaignId = run.json.campaignId;
await post(`/api/campaigns/${campaignId}/approve`);
ok(!!campaignId, `campaign ${campaignId} is LIVE`);

step(1, 'Drive the real Razorpay Checkout');
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 520, height: 900 } });
await page.goto(`${BASE}/shop/${campaignId}`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('text=Recommended for you', { timeout: 20000 });
await page.fill('input[placeholder="Optional"]', 'Checkout Test');
await page.locator('input[inputmode="tel"]').fill('9000000042');
await page.click('text=Buy now');

const frame = await page.waitForSelector('iframe.razorpay-checkout-frame', { timeout: 30000 })
  .then((h) => h.contentFrame());
ok(!!frame, 'Razorpay Checkout iframe opened');

const orders = await get('/api/dashboard/orders?limit=5');
const tooezOrder = orders.rows[0];
ok(/^order_/.test(tooezOrder.razorpay_order_id), `Razorpay order ${tooezOrder.razorpay_order_id} created for ${tooezOrder.id}`);

try {
  await frame.waitForSelector('text=/UPI/i', { timeout: 25000 });
  await frame.click('text=/UPI/i');
  await frame.waitForSelector('input[placeholder*="UPI" i], input[name*="vpa" i]', { timeout: 20000 });
  await frame.fill('input[placeholder*="UPI" i], input[name*="vpa" i]', 'success@razorpay');
  await frame.click('button:has-text("Pay"), button:has-text("Verify")');
  await page.waitForTimeout(9000);
  await page.screenshot({ path: 'checkout-state.png' });
  console.log('     screenshot saved to checkout-state.png');
} catch (e) {
  console.log(`     ! could not drive the Checkout UI automatically (${e.message.split('\n')[0]})`);
  console.log('     Complete the payment by hand in the open browser, then re-run steps 2-4.');
  await page.screenshot({ path: 'checkout-state.png' });
}

step(2, 'Ask Razorpay directly whether the payment captured (server-side reconcile)');
let settled = null;
for (let i = 0; i < 12; i++) {
  const rec = await post('/api/orders/reconcile', { orderId: tooezOrder.id });
  if (rec.json.status === 'PAID') { settled = rec.json; break; }
  await new Promise((r) => setTimeout(r, 2500));
}
ok(!!settled, settled ? 'Razorpay confirms the payment is captured' : 'payment was not captured (checkout may need manual completion)');

if (settled) {
  step(3, 'Dashboard reflects the REAL payment');
  const pays = await get('/api/dashboard/payments?limit=10');
  const p = pays.rows.find((x) => x.tooez_order_id === tooezOrder.id);
  ok(!!p, `payment row present: ${p?.razorpay_payment_id}`);
  ok(/^pay_/.test(p?.razorpay_payment_id ?? ''), 'a REAL Razorpay payment id (pay_…) is stored');
  ok(p?.confirmed_source === 'api_reconcile' || p?.confirmed_source === 'webhook',
     `confirmed by ${p?.confirmed_source} — never by the browser`);
  const ov = await get('/api/dashboard/overview?range=today');
  ok(ov.kpis.successfulPayments.value >= 1, `dashboard counts ${ov.kpis.successfulPayments.value} successful payment(s)`);

  step(4, 'Issue a REAL refund against the REAL payment');
  const refund = await post('/api/orders/refund', {
    orderId: tooezOrder.id, reason: 'automated end-to-end test', idempotencyKey: `rf_e2e_${Date.now()}`,
  });
  ok(refund.status === 200 && /^rfnd_/.test(refund.json.refundId ?? ''),
     refund.status === 200 ? `REAL refund created: ${refund.json.refundId} for ${inr(refund.json.amountPaise)}`
                           : `refund failed: ${refund.json.error}`);
  const dup = await post('/api/orders/refund', {
    orderId: tooezOrder.id, idempotencyKey: refund.json.reused ? 'x' : `rf_e2e_dup`,
  });
  ok(dup.status !== 200 || dup.json.reused, 'a second refund on the same payment is refused or deduplicated');
}

await browser.close();
console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
