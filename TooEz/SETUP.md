# TooEz — setup and Razorpay wiring

Everything you need to get from a fresh clone to a completed test transaction.

---

## 1. Install and configure

```bash
npm install
cp .env.example .env.local
```

Open `.env.local` and fill in **three** values:

| Variable | Where it comes from | Who may see it |
|---|---|---|
| `RAZORPAY_KEY_ID` | Razorpay Dashboard → **Account & Settings → API Keys → Generate Test Key**. Starts `rzp_test_`. | Public. Sent to the browser on the checkout page only, because Razorpay Checkout requires it. |
| `RAZORPAY_KEY_SECRET` | The secret shown next to that key id (only shown once — regenerate if you lost it). | **Server only.** Never sent to the browser, never logged. |
| `RAZORPAY_WEBHOOK_SECRET` | **A value you choose.** You type it into Razorpay when you create the webhook (step 3) and paste the same string here. | **Server only.** |

> The key secret and the webhook secret are **different secrets**. The key secret
> authenticates TooEz's API calls to Razorpay. The webhook secret verifies that an
> inbound webhook really came from Razorpay. TooEz refuses to run if you set them
> to the same value.

Your credentials, ready to paste:

```bash
cat > .env.local <<'EOF'
RAZORPAY_KEY_ID=rzp_test_TXwaT4YYh1FxSY
RAZORPAY_KEY_SECRET=<the secret from your Razorpay dashboard>
RAZORPAY_WEBHOOK_SECRET=<any strong string you choose — see step 3>
EOF
```

Check the wiring at any time:

```bash
npm run dev
curl -s localhost:3000/api/health | jq
```

`/api/health` reports which credentials are configured **by name only** — it never
echoes a value. The dashboard shows the same status under **Settings → Integrations**.

---

## 2. Run it

```bash
npm run dev            # http://localhost:3000  (dashboard)
```

| Surface | URL |
|---|---|
| Merchant dashboard | `http://localhost:3000/dashboard` |
| Customer food app | `http://localhost:3000/shop/<campaignId>` (opened from a live campaign) |
| Health check | `http://localhost:3000/api/health` |

Production build: `npm run build && npm start`.

With no Razorpay keys at all the app still boots, on a clearly badged **mock
gateway**, so you can develop the agent pipeline offline. With keys present the
mock is disabled and refuses to run.

---

## 3. Webhook setup

**Is a webhook required?** Yes — but it is the *safety net*, not the only path.

- For the **customer waiting at checkout**, TooEz does not wait for a webhook. The
  moment Checkout returns, the server verifies the signature and then **asks
  Razorpay directly** (`orders.fetchPayments`) whether the payment captured. That
  is authoritative and immediate.
- The **webhook** keeps the dashboard correct in every case the browser cannot
  cover: the customer closes the tab, the network drops, a payment is captured
  late, a refund settles hours later, or a payment fails asynchronously. Without it
  those orders would sit unresolved.

Both paths converge on the same `processWebhook()` state machine, and both are
deduplicated, so they can never double-count.

### Configure it

1. Expose your local server. Razorpay cannot reach `localhost`:
   ```bash
   ngrok http 3000
   ```
   Copy the `https://<something>.ngrok-free.app` URL it prints.

2. Razorpay Dashboard → **Settings → Webhooks → Add New Webhook**:

   | Field | Value |
   |---|---|
   | **Webhook URL** | `https://<your-ngrok-subdomain>.ngrok-free.app/api/webhooks/razorpay` |
   | **Secret** | The same string you put in `RAZORPAY_WEBHOOK_SECRET` |
   | **Active events** | `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`, `refund.failed` |

3. Restart `npm run dev` so the new environment variables load.

If you deploy, the URL becomes `https://<your-domain>/api/webhooks/razorpay`.

### Why those five events, and no others

| Event | Why TooEz needs it |
|---|---|
| `payment.captured` | The only asynchronous signal that money actually moved. Books revenue, releases stock, feeds the learning loop. |
| `payment.failed` | Marks the order `FAILED` permanently and offers a retry. Without it a failed attempt would sit as `CREATED` forever. |
| `order.paid` | Belt-and-braces for the capture path when Razorpay emits the order-level event. Handled by the same code and deduplicated. |
| `refund.processed` | A refund is asynchronous. This is what reverses the revenue and restores stock. |
| `refund.failed` | Tells you a refund did **not** go through, so the ledger is not silently wrong. |

Everything else Razorpay can send (`payment.authorized` beyond a no-op, settlements,
subscriptions, disputes, virtual accounts) has no meaning in TooEz's order flow, so
subscribing to it would only add noise and attack surface.

### No public URL at the venue?

Two real fallbacks, neither of which fakes anything:

```bash
# 1. Post a correctly HMAC-signed webhook to your own local endpoint.
#    The app verifies it with exactly the same code that verifies Razorpay's.
node scripts/send-webhook.mjs <razorpay_order_id> captured 10900
```

2. Click **Reconcile with Razorpay** on any order stuck at *Awaiting confirmation*
   (Orders → open the row). That performs a live, authenticated
   `orders.fetchPayments()` call and settles from Razorpay's own answer.

---

## 4. One complete test transaction

```bash
npm run dev          # terminal 1
ngrok http 3000      # terminal 2 (optional but recommended)
```

1. **Dashboard → AI Assistant → Scan for opportunities.**
   The Detection Agent reads 14 days of demand history and finds unsold inventory.
2. Press **Run agents** on *Chicken Wrap + Fries Combo*.
   The Offer Agent proposes **₹79**; the Risk Agent **vetoes** it on four policy
   rules and hands back constraints; the Offer Agent re-optimises to **₹109**,
   which is approved.
3. Press **Approve campaign** → **Open customer checkout**.
   This is the food app. Enter a name and phone, press **Buy now**.
4. Pay in Razorpay's test Checkout:
   - UPI: `success@razorpay` (or `failure@razorpay` to test the failure path)
   - Card: `4111 1111 1111 1111`, any future expiry, any CVV, OTP `1111`
5. The checkout page holds at **Awaiting confirmation**, then flips to
   **Payment confirmed** once the server has verified with Razorpay.
6. **Dashboard → Payments.** The row shows the real `pay_…` id, the `order_…` id,
   the TooEz order id, the method Razorpay reported, and whether it was confirmed
   by *webhook* or *API reconcile*.
7. **Dashboard → Overview.** Revenue, order count and success rate have moved — no
   page reload needed; the server pushes the update over SSE.
8. Open the order from the **Orders** table and press **Issue refund** to exercise
   the refund path against the real payment.

---

## 5. Automated tests

```bash
npm run dev             # terminal 1

npm run test:pipeline   # agent pipeline + webhook contract (33 assertions)
npm run test:razorpay   # REAL Razorpay test-mode integration (35 assertions)
npm test                # both
npm run test:checkout   # full browser run through the real Razorpay Checkout
```

`test:razorpay` creates a real order through the app, then independently fetches it
from Razorpay and asserts that the amount, the receipt and the `notes.tooez_order_id`
all match — proving the mapping in both directions. It also covers: forged
signature rejected, unknown order handled, duplicate delivery ignored, amount
tampering refused, failed payment books no revenue, and no secret appears in any
dashboard payload.

`test:checkout` needs a browser and outbound access to `checkout.razorpay.com`; run
it on your own machine.

---

## 6. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `Razorpay: Authentication failed` | Key id/secret mismatch, or the secret was regenerated. Re-copy both from the dashboard. |
| Webhook returns 400 `invalid_signature` | `RAZORPAY_WEBHOOK_SECRET` differs from the secret set on the webhook in Razorpay. They must match exactly. |
| Order stuck at *Awaiting confirmation* | ngrok is down or the webhook URL is wrong. Use **Reconcile with Razorpay** on the order — it settles from a live API call. |
| Health check says the two secrets are identical | You pasted the key secret into `RAZORPAY_WEBHOOK_SECRET`. Choose a different string and set it on both sides. |
| `Razorpay Checkout could not load` on the shop page | `checkout.razorpay.com` is blocked by a network, firewall or ad-blocker. The order was created; no payment was attempted. |
| No opportunities after a scan | Press **Settings → Reset demo dataset** — it re-anchors demand history to the current hour. |
