# TooEz — 2-minute demo choreography

## Before you start (30 seconds, off camera)

```bash
npm run build && npm start        # or npm run dev
```

- **Settings → Integrations → Reset demo dataset.** This re-seeds demand history
  anchored to the current hour, so "demand is falling" is a true reading of the data
  whenever you demo.
- Open two browser windows side by side: **dashboard** left, blank tab right (the
  customer checkout will open there).
- Confirm the topbar shows **TEST MODE · Razorpay Test API**. If it says
  `MOCK GATEWAY`, your keys are not loaded — say so out loud rather than glossing it.
- Pick a theme and stay in it. Dark reads better on a projector, light on a laptop.

---

## The run

**0:00 — The dashboard** *(`/dashboard`)*

> "This is a campus cloud kitchen at 2pm. The lunch rush is over. Razorpay would tell
> them they made ₹9,967 today. TooEz asks a different question."

Point at **Revenue today ₹9,967** and **Discount budget used 80%**.

**0:10 — Detect** *(`/dashboard/agents`)*

Press **Scan for opportunities**. Three cards appear.

> "The Detection Agent just read fourteen days of hourly demand. Fourteen wrap combos
> unsold, demand forecast to fall 29% in the next hour, only one of them sells at list
> price in the next thirty minutes. ₹1,937 of inventory at risk, ₹755 recoverable.
> That's arithmetic, not a language model."

**0:30 — Decide, and get stopped**

Press **Run agents** on *Chicken Wrap + Fries Combo*.

> "The Offer Agent optimises revenue across a price ladder. It proposes ₹79."

Point at the price ladder table: ₹79 has the highest expected revenue, ₹904.

> "And ₹79 is a terrible idea, because the wrap costs ₹82 to make."

**0:50 — The veto** *(this is the moment)*

Point at the red card.

> "The Risk Agent vetoed it. Not a second opinion from another prompt — a separate
> component with separate data access. It's the only agent that can read the merchant's
> policy table, and it recomputed the margin from unit cost itself rather than trusting
> what the Offer Agent claimed. Four rules fired: negative margin, discount cap, the
> daily discount budget, and a hard below-cost stop."

Scroll to *Constraints handed back to the Offer Agent*.

> "It hands back a feasible set, never a price. Minimum ₹105.13, maximum subsidy ₹870.
> The Offer Agent re-optimises inside that and comes back with ₹109 — which the learned
> data says converts at 8.6%, better than ₹99 did. Seven of seven checks pass."

> "One agent stopped another agent from taking a financial action. No campaign row was
> created for ₹79, and an order can only attach to a campaign — so that price was
> structurally incapable of reaching Razorpay."

**1:20 — Approve**

Press **Approve campaign**.

> "Human in the loop. Nothing is sellable until the merchant says so."

Press **Open customer checkout** — the customer page opens in the second window.

**1:35 — Transact**

> "₹149 wrap, ₹109 for the next 30 minutes."

Press **Buy now** → Razorpay test checkout → pay with `success@razorpay` (or card
`4111 1111 1111 1111`, OTP `1111`).

Point at the amber panel while it settles:

> "The browser says it worked. TooEz doesn't believe the browser. It's holding at
> AWAITING CONFIRMATION until Razorpay's signed webhook lands."

**1:50 — Learn**

Switch to **Overview**. Revenue, order count and success rate have moved with no page
reload. Then open **Payments** — the real `pay_…` id, the `order_…` id, the TooEz order
id, and whether it was confirmed by webhook or API reconcile.

> "Payment captured, confirmed by webhook. Revenue booked, one unit of inventory
> released, and the conversion written back into the pricing model — the next
> recommendation for this SKU is already different."

Scroll the audit trail: every agent action, timestamped, with the veto in red.

> "Detect, decide, risk-check, approve, transact, learn. Every step auditable."

---

## Optional 30-second encore: the failure path

On the customer page press **Buy now** again and pay with `failure@razorpay`.

> "Payment fails. The Settlement Agent marks that order FAILED permanently and issues a
> retry — which creates a *new* order, never a reuse of the failed one, so a late
> webhook can't resurrect it as revenue. Retry, pay, done."

## Optional 20-second encore: the agent that says no at all

Press **Run agents** on *Paneer Kathi Roll*.

> "This one is still selling at full price right now. The Risk Agent's cannibalization
> rule kills the opportunity outright — no discount is permissible, so no campaign is
> created. The right answer is sometimes 'do nothing', and the system can reach it."

---

## If something goes wrong on stage

| Symptom | Fix |
|---|---|
| No opportunities after a scan | **Settings → Reset demo dataset** — it re-anchors demand history to the current hour. |
| Razorpay checkout won't open | The header will say why. Falls back to the mock gateway if you remove the keys and restart. |
| Payment stuck on AWAITING CONFIRMATION | ngrok is down. Open the order and press **Reconcile with Razorpay** (a real API call), or run `node scripts/send-webhook.mjs <rzp_order_id> captured 10900`. |
| Wrong theme for the room | Topbar sun/moon toggle, or **Settings → Appearance**. |
| Dashboard not updating | The SSE stream fell back to 4-second polling. Wait, or reload. |
