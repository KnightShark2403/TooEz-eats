# TooEz — 4-minute pitch script

**Tagline:** AI Revenue Agents for Agentic Commerce
**Track:** AI Growth & Agentic Commerce

---

## 0:00 – 0:35 · The problem

> Every merchant with perishable inventory or bookable capacity loses revenue to the
> same thing: an opportunity that appears and disappears before anyone notices it.
>
> Fourteen wraps left at 2pm. Six empty chairs at a salon on a Tuesday. A bakery case
> at 6pm. Nobody is doing the arithmetic in that thirty-minute window, because the
> owner is running the shop.
>
> Payment systems are excellent at telling merchants what already happened. Razorpay
> can tell this kitchen it made ₹9,967 today. What nobody tells them is: *what can we
> do in the next thirty minutes to make it more?*

## 0:35 – 1:05 · What TooEz is

> TooEz is a multi-agent revenue system that answers that question and then acts on it.
>
> It runs a closed loop: **detect** the opportunity, **decide** on a price,
> **risk-check** that price independently, get merchant **approval**, **transact**
> through Razorpay, and **learn** from what happened.
>
> Our demo is a campus cloud kitchen, but nothing in the system knows about food. The
> inputs are inventory, demand history, unit cost and merchant policy — which a bakery,
> a salon, a retail store or a cloud kitchen all have. Food is the first customer, not
> the product.

## 1:05 – 2:20 · Live demo *(see DEMO.md)*

Hit these five beats and nothing else:

1. **Scan.** "₹755 recoverable — fourteen units, demand falling 29%, from fourteen days
   of hourly history. Deterministic arithmetic, not a language model guessing."
2. **The Offer Agent proposes ₹79.** "That's the revenue-maximising price on the learned
   demand curve. It is also below the ₹82 it costs to make."
3. **The Risk Agent vetoes it.** *Let the red card sit on screen.* "Four rules fired.
   This is not a second prompt agreeing with the first — it is a separate component,
   it is the only one that can read the merchant's policy table, and it recomputes
   margin from unit cost rather than trusting what the Offer Agent claimed."
4. **The revision.** "It hands back constraints, never a price. The Offer Agent
   re-optimises inside them and returns ₹109 — which our own campaign data says
   converts better than ₹99 did. Seven of seven checks pass. Merchant approves."
5. **The payment.** "Razorpay Checkout. And notice: the browser says it succeeded, and
   TooEz refuses to book it. It waits for the signed webhook. Then revenue moves, stock
   drops, and the conversion is written back into the pricing model."

## 2:20 – 3:05 · Why the architecture is the point

> The interesting problem in agentic commerce isn't getting a model to suggest a
> discount. It's making it safe to let software touch money.
>
> Three things make that true here, and all three are in the code:
>
> **Separation of duties.** The Offer Agent physically cannot read merchant policy. It
> is a revenue optimiser, and left alone it proposes prices that destroy the business.
> That is not a bug we tolerated — it is the property that makes the veto meaningful.
>
> **The veto is structural, not advisory.** A vetoed price produces no campaign row, and
> a Razorpay order can only ever be attached to a campaign. The price we vetoed was
> incapable of reaching the payment layer.
>
> **Razorpay's webhook is the source of truth.** The endpoint our browser calls after
> checkout verifies the signature and still cannot mark an order paid — the best it can
> do is `AWAITING_CONFIRMATION`. Duplicate orders are blocked by a database unique
> constraint, not an if-statement. Webhook replays are no-ops. A failed payment stays
> failed forever, and a retry is a new order.
>
> And every one of those steps writes an audit row. A merchant can ask "why did you
> charge ₹109?" and get the actual answer, with the numbers.

## 3:05 – 3:35 · The learning loop

> The system's pricing improves from its own outcomes. Every captured payment writes
> impressions and conversions back to a price-response table, blended with an
> elasticity prior by Bayesian shrinkage — so a price point with real evidence outweighs
> the model's guess.
>
> In our data ₹109 converts at 9% and ₹99 converts at 4%. Cheaper was worse. No amount
> of prompting finds that; only outcomes do. That table is why the revision landed on
> ₹109 rather than the cheapest legal price.

## 3:35 – 4:00 · Why Razorpay, and what's next

> Razorpay isn't a checkout button on the end of this. It is the execution layer that
> turns an agent's decision into money, and the webhook is the system's definition of
> truth. Every agent decision terminates in a Razorpay order or in nothing at all.
>
> Next: Razorpay Route to split settlement between merchant and platform, Payment Links
> so an offer can go out over WhatsApp without a storefront, and Razorpay's own risk
> signals as an eighth input to the Risk Agent.
>
> Payment systems today are a ledger. TooEz makes them an operator.

---

## Anticipated questions

**"Is the Risk Agent just another LLM prompt?"**
No. It is a deterministic rule engine — `src/agents/risk.ts`. Seven rules, each
returning observed-versus-limit. It reads the policy table and recomputes margin from
unit cost. There is no model in that path, which is exactly why we trust it to stop a
financial action.

**"Where does the LLM actually run?"**
Narration only, and it's optional. It receives facts the deterministic code already
computed and writes a sentence. Every offer row records `reasoning_source`. Pull the
API key and the system behaves identically.

**"How do you know the payment really succeeded?"**
We verify the HMAC over the raw webhook body with the webhook secret, and we only trust
that or a server-side `orders.fetchPayments()` call. The browser is never authoritative.

**"What stops a double charge?"**
`UNIQUE(campaign_id, idempotency_key)` on the orders table, plus a unique index on the
Razorpay order id. Duplicate requests return the existing Razorpay order.

**"How much of this is mocked?"**
The merchant's demand history and inventory are seeded — a real deployment reads them
from a POS. Everything else is real, and if you run it without Razorpay keys the app
tells you so in the header rather than pretending.
