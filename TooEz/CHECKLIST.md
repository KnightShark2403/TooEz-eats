# Pre-submission checklist

## Code and repo
- [ ] `npm install` works from a clean clone (`rm -rf node_modules .next data/tooez.db*`).
- [ ] `npm run build` completes with no errors.
- [ ] `npx tsc --noEmit` is clean.
- [ ] `.env.local` is **not** committed (`git status` should not list it).
- [ ] No secret is hardcoded: `grep -rn "rzp_test_\|rzp_live_" src/` returns nothing.
- [ ] No secret in the client bundle: `grep -r "$RAZORPAY_KEY_SECRET" .next/static` returns nothing.
- [ ] `RAZORPAY_WEBHOOK_SECRET` is a different value from `RAZORPAY_KEY_SECRET`.
- [ ] README, SETUP.md, ARCHITECTURE.md, DEMO.md and PITCH.md are in the repo root.

## Functionality
- [ ] `npm run dev`, then `npm test` → **ALL CHECKS PASSED** on both suites.
- [ ] `curl localhost:3000/api/health` reports `ok: true`, `testMode: true`, no problems.
- [ ] **Settings → Reset demo dataset** → **Scan** produces three opportunities.
- [ ] Wrap combo: ₹79 **VETOED** on 4 rules → ₹109 **APPROVED**.
- [ ] Paneer roll: pipeline **ABANDONED** on cannibalization, no campaign created.
- [ ] Cold brew: ₹59 vetoed on discount cap → ₹79 approved.
- [ ] Approve → customer page opens and shows the offer with a live countdown.
- [ ] Payment succeeds → dashboard revenue increases **without a page reload**.
- [ ] Failed payment → order shows FAILED, retry creates a **new** order id.
- [ ] Audit trail shows every actor and the veto in red.
- [ ] Analytics shows the new conversion appended at the campaign price.
- [ ] Every sidebar route opens with no console error, in **both** themes.
- [ ] Theme toggle persists across a reload.
- [ ] Payments table shows the real `pay_…` / `order_…` / TooEz order id mapping.
- [ ] Refund on a paid order succeeds and reverses the revenue on Overview.
- [ ] No horizontal scrollbar at 1440px, 1024px and 768px.

## Razorpay (if demoing the real integration)
- [ ] Keys are **test mode** (`rzp_test_…`) — header shows `Razorpay TEST`.
- [ ] ngrok is running and the webhook URL in the Razorpay dashboard matches it.
- [ ] Webhook secret in the dashboard === `RAZORPAY_WEBHOOK_SECRET` in `.env.local`.
- [ ] Events subscribed: `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`, `refund.failed`.
- [ ] Topbar shows **TEST MODE · Razorpay Test API**; Settings → Integrations shows all three credentials configured.
- [ ] A test payment produces a `payment.captured` delivery with a 200 in the Razorpay
      dashboard's webhook log.
- [ ] Fallback rehearsed: `node scripts/send-webhook.mjs <order_id> captured <amount>`.

## Demo hygiene
- [ ] Ran **Reset demo** within the last few minutes (demand history anchors to the hour).
- [ ] Two windows arranged: dashboard left, checkout right.
- [ ] Browser zoom at 100%, notifications off.
- [ ] Rehearsed the full run under 2 minutes at least twice.
- [ ] You can say in one sentence what is seeded and what is real, without hedging.

## Submission
- [ ] Repo URL, and the README's Quick start actually works for a stranger.
- [ ] Demo video recorded (screen + audio), under the time limit.
- [ ] Track selected: **AI Growth & Agentic Commerce**.
- [ ] The honest-scope section of the README is included — judges reward it.
