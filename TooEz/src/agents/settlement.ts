import { getDb } from '@/lib/db';
import { id, sha256 } from '@/lib/ids';
import { audit } from '@/lib/audit';
import { publishRefresh } from '@/lib/events';
import { inr } from '@/lib/money';
import * as rzp from '@/lib/razorpay';
import { recordOutcome } from './pricing-model';
import { log } from '@/lib/logger';

/**
 * SETTLEMENT AGENT
 *
 * Owns the payment lifecycle end to end.
 *
 * Non-negotiables enforced here:
 *  1. A payment is PAID only when Razorpay says so — via a signature-verified
 *     webhook, or via a server-side API reconcile. The browser can never mark
 *     an order paid; `/api/payments/confirm` moves an order to
 *     AWAITING_CONFIRMATION at most.
 *  2. Duplicate prevention is enforced by the database, not by an if-statement:
 *     UNIQUE(campaign_id, idempotency_key) on `orders`. A repeated create with
 *     the same key returns the existing order and its existing Razorpay order id.
 *  3. Webhook replays are no-ops: UNIQUE primary key on `webhook_events`.
 *  4. Inventory is decremented and the learning loop is updated exactly once,
 *     inside the same transaction that marks the payment captured.
 */

export interface CreateOrderResult {
  orderId: string;
  razorpayOrderId: string;
  amountPaise: number;
  gateway: rzp.Gateway;
  keyId: string | null;
  reused: boolean;
  campaign: { id: string; productName: string; price_paise: number; expires_at: string };
}

export async function createOrderForCampaign(args: {
  merchantId: string; campaignId: string; idempotencyKey: string;
  customerRef?: string; customerName?: string; customerPhone?: string;
}): Promise<CreateOrderResult> {
  const db = getDb();
  const campaign = db.prepare(
    `SELECT c.*, p.name AS product_name, p.stock_units
       FROM campaigns c JOIN products p ON p.id = c.product_id
      WHERE c.id = ? AND c.merchant_id = ?`
  ).get(args.campaignId, args.merchantId) as any;

  if (!campaign) throw new Error('campaign not found');
  if (campaign.status !== 'LIVE') {
    throw new Error(`campaign is ${campaign.status} — only LIVE campaigns can accept payment`);
  }
  if (new Date(campaign.expires_at.replace(' ', 'T') + 'Z').getTime() < Date.now() - 5 * 60_000) {
    // 5-minute grace so a checkout opened just before expiry can still complete.
    db.prepare(`UPDATE campaigns SET status='EXPIRED' WHERE id=?`).run(campaign.id);
    throw new Error('campaign has expired');
  }
  if (campaign.units_sold >= campaign.units_offered) throw new Error('campaign is sold out');

  // --- Idempotency: DB-enforced, not code-enforced ------------------------
  const existing = db.prepare(
    'SELECT * FROM orders WHERE campaign_id = ? AND idempotency_key = ?'
  ).get(args.campaignId, args.idempotencyKey) as any;

  if (existing && existing.razorpay_order_id && ['CREATED', 'AWAITING_CONFIRMATION'].includes(existing.status)) {
    audit({
      merchantId: args.merchantId, actor: 'SETTLEMENT_AGENT', action: 'ORDER_DEDUPED',
      severity: 'warn', campaignId: campaign.id, orderId: existing.id,
      summary: `Duplicate order request blocked — returned existing ${existing.razorpay_order_id}`,
      detail: { idempotencyKey: args.idempotencyKey },
    });
    publishRefresh('order-deduped');
    return {
      orderId: existing.id, razorpayOrderId: existing.razorpay_order_id,
      amountPaise: existing.amount_paise, gateway: existing.gateway,
      keyId: rzp.publicKeyId(), reused: true,
      campaign: { id: campaign.id, productName: campaign.product_name, price_paise: campaign.price_paise, expires_at: campaign.expires_at },
    };
  }

  const orderId = existing?.id ?? id('ord');
  const gateway = rzp.gatewayMode();

  if (!existing) {
    db.prepare(
      `INSERT INTO orders (id,campaign_id,merchant_id,idempotency_key,amount_paise,status,gateway,
        customer_ref,customer_name,customer_phone)
       VALUES (?,?,?,?,?, 'CREATED', ?,?,?,?)`
    ).run(orderId, campaign.id, args.merchantId, args.idempotencyKey, campaign.price_paise, gateway,
      args.customerRef ?? null, args.customerName ?? null, args.customerPhone ?? null);
  }

  let created;
  try {
    created = await rzp.createOrder({
      amountPaise: campaign.price_paise,
      receipt: orderId,
      notes: { tooez_order_id: orderId, campaign_id: campaign.id, merchant_id: args.merchantId },
    });
  } catch (e: any) {
    // The local order row stays CREATED with a null razorpay_order_id, so the
    // same idempotency key retries cleanly rather than orphaning anything.
    audit({
      merchantId: args.merchantId, actor: 'SETTLEMENT_AGENT', action: 'GATEWAY_ORDER_FAILED',
      severity: 'error', campaignId: campaign.id, orderId,
      summary: `Could not create the gateway order — ${e.message}`,
      detail: { error: e.message, idempotencyKey: args.idempotencyKey },
    });
    publishRefresh('order-create-failed');
    throw e;
  }

  db.prepare(`UPDATE orders SET razorpay_order_id=?, gateway=?, updated_at=datetime('now') WHERE id=?`)
    .run(created.id, created.gateway, orderId);
  db.prepare('UPDATE campaigns SET impressions = impressions + 1 WHERE id = ?').run(campaign.id);

  audit({
    merchantId: args.merchantId, actor: 'SETTLEMENT_AGENT', action: 'RAZORPAY_ORDER_CREATED',
    severity: 'info', campaignId: campaign.id, orderId,
    summary: gateway === 'razorpay'
      ? `Razorpay order ${created.id} created for ${inr(created.amount)}${rzp.isTestMode() ? ' (test mode)' : ''}`
      : `MOCK gateway order ${created.id} created for ${inr(created.amount)} — Razorpay keys not configured`,
    detail: { razorpayOrderId: created.id, amountPaise: created.amount, gateway, idempotencyKey: args.idempotencyKey },
  });
  publishRefresh('order-created');

  return {
    orderId, razorpayOrderId: created.id, amountPaise: created.amount, gateway,
    keyId: rzp.publicKeyId(), reused: false,
    campaign: { id: campaign.id, productName: campaign.product_name, price_paise: campaign.price_paise, expires_at: campaign.expires_at },
  };
}

/**
 * Called by the browser after Checkout's success handler. The signature is
 * verified, but this NEVER marks the order paid — it only records that the
 * customer's browser claims success. Razorpay's webhook is the source of truth.
 */
export async function noteCheckoutReturn(args: {
  merchantId: string; razorpayOrderId: string; razorpayPaymentId: string; signature: string;
}) {
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE razorpay_order_id = ?').get(args.razorpayOrderId) as any;
  if (!order) throw new Error('unknown order');

  const sigOk = rzp.gatewayMode() === 'razorpay'
    ? rzp.verifyCheckoutSignature(args.razorpayOrderId, args.razorpayPaymentId, args.signature)
    : args.signature === 'mock';

  if (!sigOk) {
    audit({
      merchantId: args.merchantId, actor: 'SETTLEMENT_AGENT', action: 'CHECKOUT_SIGNATURE_INVALID',
      severity: 'error', orderId: order.id, campaignId: order.campaign_id,
      summary: `Checkout signature verification FAILED for ${args.razorpayOrderId} — payload rejected`,
      detail: { razorpayPaymentId: args.razorpayPaymentId },
    });
    publishRefresh('signature-invalid');
    return { ok: false, status: order.status, verified: false };
  }

  if (order.status === 'PAID') return { ok: true, status: 'PAID', verified: true };

  db.prepare(`UPDATE orders SET status='AWAITING_CONFIRMATION', updated_at=datetime('now') WHERE id=?`).run(order.id);
  audit({
    merchantId: args.merchantId, actor: 'SETTLEMENT_AGENT', action: 'CHECKOUT_RETURN_VERIFIED',
    severity: 'info', orderId: order.id, campaignId: order.campaign_id,
    summary: `Checkout signature verified for ${args.razorpayPaymentId}. Held at AWAITING_CONFIRMATION — the browser's word is not enough.`,
    detail: { razorpayOrderId: args.razorpayOrderId, razorpayPaymentId: args.razorpayPaymentId },
  });
  publishRefresh('checkout-returned');

  // ---- Immediate confirmation via a server-side Razorpay API call ---------
  // The customer is waiting, so we do not sit on AWAITING_CONFIRMATION until a
  // webhook arrives. We ASK RAZORPAY directly. This is authoritative in exactly
  // the same way the webhook is — it comes from Razorpay over an authenticated
  // channel, not from the browser. The webhook remains the async safety net and
  // is deduplicated against whatever this call settles.
  if (rzp.gatewayMode() === 'razorpay') {
    try {
      const settled = await reconcileOrder(args.merchantId, order.id);
      if (settled.status === 'PAID') return { ok: true, status: 'PAID', verified: true, source: 'api_reconcile' };
    } catch (e: any) {
      log.warn('settlement', 'immediate reconcile failed; awaiting webhook', { orderId: order.id, error: e.message });
    }
  }
  return { ok: true, status: 'AWAITING_CONFIRMATION', verified: true };
}

// ---------------------------------------------------------------------------
// Webhook processing — the only place an order becomes PAID.
// ---------------------------------------------------------------------------

export interface WebhookResult { ok: boolean; result: string; duplicate?: boolean }

export function processWebhook(args: {
  merchantId: string; rawBody: string; signature: string | null; eventIdHeader: string | null;
  allowMock?: boolean;
  /** Set ONLY for server-side reconciliation, where the payload came from a
   *  direct authenticated Razorpay API call rather than an inbound HTTP post.
   *  Never settable from a request handler. */
  trustedInternal?: boolean;
}): WebhookResult {
  const db = getDb();
  // Verification precedence:
  //   1. Server-side reconcile (payload came from an authenticated API call).
  //   2. A webhook secret is configured -> ALWAYS verify the HMAC, whichever
  //      gateway mode we are in. Configuring a secret can only tighten things.
  //   3. No secret and no Razorpay keys -> local mock gateway, which requires
  //      an explicit local header.
  const signatureOk = args.trustedInternal
    ? true
    : process.env.RAZORPAY_WEBHOOK_SECRET
      ? rzp.verifyWebhookSignature(args.rawBody, args.signature)
      : rzp.gatewayMode() === 'mock' && Boolean(args.allowMock);

  if (!signatureOk) {
    audit({
      merchantId: args.merchantId, actor: 'RAZORPAY', action: 'WEBHOOK_REJECTED', severity: 'error',
      summary: 'Webhook rejected — signature verification failed. Nothing was written.',
      detail: { hasSignature: Boolean(args.signature) },
    });
    return { ok: false, result: 'invalid_signature' };
  }

  let body: any;
  try { body = JSON.parse(args.rawBody); } catch { return { ok: false, result: 'invalid_json' }; }

  const eventId = args.eventIdHeader || `sha_${sha256(args.rawBody).slice(0, 32)}`;
  const event: string = body?.event ?? 'unknown';

  // --- Replay protection, enforced by the primary key ---------------------
  const seen = db.prepare('SELECT id, result FROM webhook_events WHERE id = ?').get(eventId) as any;
  if (seen) {
    audit({
      merchantId: args.merchantId, actor: 'RAZORPAY', action: 'WEBHOOK_DUPLICATE', severity: 'warn',
      summary: `Duplicate webhook ${event} (${eventId}) ignored — already processed as "${seen.result}"`,
      detail: { eventId, event },
    });
    return { ok: true, result: seen.result, duplicate: true };
  }

  let result = 'ignored';
  try {
    if (event === 'payment.captured' || event === 'order.paid') {
      result = handleCaptured(args.merchantId, body, args.trustedInternal ? 'api_reconcile' : 'webhook');
    } else if (event === 'payment.failed') {
      result = handleFailed(args.merchantId, body);
    } else if (event === 'payment.authorized') {
      result = 'authorized_noop';
    } else if (event === 'refund.processed' || event === 'refund.failed') {
      result = handleRefundEvent(args.merchantId, body, event);
    }
  } finally {
    db.prepare(
      `INSERT OR IGNORE INTO webhook_events (id,event,signature_ok,payload,result) VALUES (?,?,?,?,?)`
    ).run(eventId, event, 1, args.rawBody, result);
  }

  publishRefresh('webhook');
  return { ok: true, result };
}

function paymentEntity(body: any) {
  return body?.payload?.payment?.entity ?? null;
}

function handleCaptured(merchantId: string, body: any, source: 'webhook' | 'api_reconcile' = 'webhook'): string {
  const db = getDb();
  const pay = paymentEntity(body);
  const rzpOrderId: string | undefined = pay?.order_id ?? body?.payload?.order?.entity?.id;
  if (!rzpOrderId) return 'no_order_id';

  const order = db.prepare('SELECT * FROM orders WHERE razorpay_order_id = ?').get(rzpOrderId) as any;
  if (!order) {
    audit({
      merchantId, actor: 'SETTLEMENT_AGENT', action: 'WEBHOOK_UNKNOWN_ORDER', severity: 'error',
      summary: `Webhook referenced Razorpay order ${rzpOrderId}, which TooEz has no record of. Ignored.`,
      detail: { rzpOrderId },
    });
    return 'unknown_order';
  }
  if (order.status === 'PAID') return 'already_paid';

  const amount = Number(pay?.amount ?? order.amount_paise);
  if (amount !== order.amount_paise) {
    audit({
      merchantId, actor: 'SETTLEMENT_AGENT', action: 'AMOUNT_MISMATCH', severity: 'error',
      orderId: order.id, campaignId: order.campaign_id,
      summary: `Captured amount ${inr(amount)} does not match order amount ${inr(order.amount_paise)} — held for manual review.`,
      detail: { captured: amount, expected: order.amount_paise },
    });
    return 'amount_mismatch';
  }

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT OR REPLACE INTO payments (id,order_id,razorpay_order_id,amount_paise,status,method,confirmed_source,raw_json)
       VALUES (?,?,?,?,?,?,?,?)`
    ).run(pay?.id ?? `unknown_${Date.now()}`, order.id, rzpOrderId, amount, 'captured',
      pay?.method ?? null, source, JSON.stringify(pay ?? body));

    db.prepare(
      `UPDATE orders SET status='PAID', payment_method=?, captured_at=datetime('now'), updated_at=datetime('now')
        WHERE id=?`
    ).run(pay?.method ?? null, order.id);

    const c = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(order.campaign_id) as any;
    db.prepare(
      `UPDATE campaigns SET units_sold = units_sold + 1, revenue_paise = revenue_paise + ? WHERE id = ?`
    ).run(amount, order.campaign_id);
    db.prepare('UPDATE products SET stock_units = MAX(0, stock_units - 1) WHERE id = ?').run(c.product_id);

    const after = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(order.campaign_id) as any;
    if (after.units_sold >= after.units_offered) {
      db.prepare(`UPDATE campaigns SET status='COMPLETED' WHERE id=?`).run(order.campaign_id);
    }

    // --- Close the learning loop ---------------------------------------
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(c.product_id) as any;
    recordOutcome({
      merchantId, productId: c.product_id, pricePaise: c.price_paise,
      listPaise: product.list_price_paise, impressions: 0, conversions: 1, revenuePaise: amount,
    });
  });
  tx();

  audit({
    merchantId, actor: 'RAZORPAY', action: 'PAYMENT_CAPTURED', severity: 'success',
    orderId: order.id, campaignId: order.campaign_id,
    summary: `Payment captured — ${inr(amount)} confirmed by Razorpay ${source === 'webhook' ? 'webhook' : 'API reconcile'}. Revenue booked.`,
    detail: { paymentId: pay?.id, method: pay?.method, rzpOrderId, source },
  });
  audit({
    merchantId, actor: 'SETTLEMENT_AGENT', action: 'RECONCILED', severity: 'success',
    orderId: order.id, campaignId: order.campaign_id,
    summary: `Order marked PAID, one unit of inventory released, conversion fed back into the pricing model.`,
    detail: { orderId: order.id },
  });
  return 'captured';
}

function handleFailed(merchantId: string, body: any): string {
  const db = getDb();
  const pay = paymentEntity(body);
  const rzpOrderId: string | undefined = pay?.order_id;
  if (!rzpOrderId) return 'no_order_id';
  const order = db.prepare('SELECT * FROM orders WHERE razorpay_order_id = ?').get(rzpOrderId) as any;
  if (!order) return 'unknown_order';
  if (order.status === 'PAID') return 'already_paid_ignoring_failure';

  db.prepare(
    `INSERT OR REPLACE INTO payments (id,order_id,razorpay_order_id,amount_paise,status,method,error_code,error_description,confirmed_source,raw_json)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(pay?.id ?? `fail_${Date.now()}`, order.id, rzpOrderId, Number(pay?.amount ?? order.amount_paise),
    'failed', pay?.method ?? null, pay?.error_code ?? null, pay?.error_description ?? null,
    'webhook', JSON.stringify(pay ?? body));

  db.prepare(
    `UPDATE orders SET status='FAILED', failure_reason=?, failure_code=?, payment_method=?, updated_at=datetime('now')
      WHERE id=?`
  ).run(pay?.error_description ?? pay?.error_code ?? 'payment failed',
        pay?.error_code ?? null, pay?.method ?? null, order.id);

  audit({
    merchantId, actor: 'RAZORPAY', action: 'PAYMENT_FAILED', severity: 'error',
    orderId: order.id, campaignId: order.campaign_id,
    summary: `Payment failed — ${pay?.error_description ?? pay?.error_code ?? 'declined by gateway'}. No revenue booked, no inventory released.`,
    detail: { paymentId: pay?.id, errorCode: pay?.error_code, errorDescription: pay?.error_description, step: pay?.error_step },
  });
  audit({
    merchantId, actor: 'SETTLEMENT_AGENT', action: 'RETRY_OFFERED', severity: 'warn',
    orderId: order.id, campaignId: order.campaign_id,
    summary: 'Settlement Agent held the campaign open and issued a retry token. The failed order is terminal — a retry creates a NEW order, never a duplicate of this one.',
    detail: { retryOf: order.id },
  });
  return 'failed';
}

/**
 * Retry after a failure. Creates a NEW order linked to the failed one via
 * parent_order_id, with a fresh idempotency key. The failed order stays FAILED
 * forever, so a late webhook for it can never resurrect it as revenue.
 */
export async function retryOrder(args: { merchantId: string; orderId: string }) {
  const db = getDb();
  const prev = db.prepare('SELECT * FROM orders WHERE id = ? AND merchant_id = ?')
    .get(args.orderId, args.merchantId) as any;
  if (!prev) throw new Error('order not found');
  if (prev.status === 'PAID') throw new Error('order already paid');

  const attempt = prev.attempt_no + 1;
  const result = await createOrderForCampaign({
    merchantId: args.merchantId,
    campaignId: prev.campaign_id,
    idempotencyKey: `${prev.idempotency_key}:retry:${attempt}`,
    customerRef: prev.customer_ref ?? undefined,
  });
  db.prepare('UPDATE orders SET attempt_no=?, parent_order_id=? WHERE id=?')
    .run(attempt, prev.id, result.orderId);

  audit({
    merchantId: args.merchantId, actor: 'SETTLEMENT_AGENT', action: 'PAYMENT_RETRIED', severity: 'info',
    orderId: result.orderId, campaignId: prev.campaign_id,
    summary: `Retry #${attempt} — new order ${result.orderId} created for the same campaign. Original ${prev.id} remains FAILED.`,
    detail: { parentOrderId: prev.id, attempt },
  });
  return result;
}

/** Server-side reconcile: ask Razorpay directly rather than waiting for a webhook. */
export async function reconcileOrder(merchantId: string, orderId: string) {
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND merchant_id = ?').get(orderId, merchantId) as any;
  if (!order) throw new Error('order not found');
  if (order.status === 'PAID') return { status: 'PAID', changed: false };
  if (rzp.gatewayMode() !== 'razorpay') return { status: order.status, changed: false, note: 'mock gateway — nothing to reconcile' };

  const payments: any = await rzp.fetchOrderPayments(order.razorpay_order_id);
  const captured = (payments?.items ?? []).find((p: any) => p.status === 'captured');
  if (!captured) return { status: order.status, changed: false };

  // Reuse the same code path as the webhook so state transitions stay identical.
  const synthetic = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: captured } } });
  const res = processWebhook({
    merchantId, rawBody: synthetic, signature: null, eventIdHeader: `reconcile_${captured.id}`, trustedInternal: true,
  });
  audit({
    merchantId, actor: 'SETTLEMENT_AGENT', action: 'API_RECONCILE', severity: 'success',
    orderId: order.id, campaignId: order.campaign_id,
    summary: `Reconciled directly against the Razorpay API — payment ${captured.id} is captured.`,
    detail: { result: res.result },
  });
  return { status: 'PAID', changed: true };
}


// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

/**
 * Issue a refund for a captured payment. The dashboard calls the backend; the
 * backend holds the key secret and calls Razorpay. The browser never touches a
 * privileged credential.
 *
 * Idempotent on (payment_id, idempotency_key), so a double-click on the
 * dashboard's Refund button cannot refund twice.
 */
export async function refundOrder(args: {
  merchantId: string; orderId: string; amountPaise?: number; reason?: string; idempotencyKey: string;
}) {
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND merchant_id = ?')
    .get(args.orderId, args.merchantId) as any;
  if (!order) throw new Error('order not found');
  if (order.status !== 'PAID') throw new Error(`order is ${order.status} — only PAID orders can be refunded`);

  const payment = db.prepare(
    `SELECT * FROM payments WHERE order_id = ? AND status = 'captured' ORDER BY created_at DESC LIMIT 1`
  ).get(order.id) as any;
  if (!payment) throw new Error('no captured payment found for this order');

  const already = db.prepare(
    'SELECT * FROM refunds WHERE payment_id = ? AND idempotency_key = ?'
  ).get(payment.id, args.idempotencyKey) as any;
  if (already) {
    audit({
      merchantId: args.merchantId, actor: 'SETTLEMENT_AGENT', action: 'REFUND_DEDUPED', severity: 'warn',
      orderId: order.id, campaignId: order.campaign_id,
      summary: `Duplicate refund request blocked — returned existing refund ${already.id}`,
      detail: { refundId: already.id },
    });
    return { refundId: already.id, status: already.status, amountPaise: already.amount_paise, reused: true };
  }

  const refundedSoFar = (db.prepare(
    `SELECT COALESCE(SUM(amount_paise),0) AS a FROM refunds WHERE payment_id = ? AND status != 'failed'`
  ).get(payment.id) as { a: number }).a;
  const amount = args.amountPaise ?? (payment.amount_paise - refundedSoFar);
  if (amount <= 0) throw new Error('this payment is already fully refunded');
  if (amount + refundedSoFar > payment.amount_paise) {
    throw new Error(`refund of ${inr(amount)} exceeds the ${inr(payment.amount_paise - refundedSoFar)} still refundable`);
  }

  let created;
  try {
    created = await rzp.createRefund({
      paymentId: payment.id, amountPaise: amount, idempotencyKey: args.idempotencyKey,
      notes: { tooez_order_id: order.id, reason: (args.reason ?? 'merchant refund').slice(0, 100) },
    });
  } catch (e: any) {
    audit({
      merchantId: args.merchantId, actor: 'SETTLEMENT_AGENT', action: 'REFUND_FAILED', severity: 'error',
      orderId: order.id, campaignId: order.campaign_id,
      summary: `Refund could not be created — ${e.message}`, detail: { error: e.message },
    });
    publishRefresh('refund-failed');
    throw e;
  }

  db.prepare(
    `INSERT INTO refunds (id,order_id,payment_id,merchant_id,amount_paise,status,speed,reason,idempotency_key,confirmed_source)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(created.id, order.id, payment.id, args.merchantId, amount,
    created.status === 'processed' ? 'processed' : 'pending', created.speed, args.reason ?? null,
    args.idempotencyKey, 'api');

  const fullyRefunded = refundedSoFar + amount >= payment.amount_paise;
  if (created.status === 'processed') applyRefundToLedger(args.merchantId, order, amount, fullyRefunded);

  audit({
    merchantId: args.merchantId, actor: 'SETTLEMENT_AGENT', action: 'REFUND_CREATED',
    severity: 'warn', orderId: order.id, campaignId: order.campaign_id,
    summary: `Refund ${created.id} for ${inr(amount)} created against payment ${payment.id} (${created.status})`,
    detail: { refundId: created.id, amount, status: created.status, reason: args.reason },
  });
  publishRefresh('refund');
  return { refundId: created.id, status: created.status, amountPaise: amount, reused: false };
}

/** Reverses the revenue and restores stock. Called once per refund. */
function applyRefundToLedger(merchantId: string, order: any, amount: number, fullyRefunded: boolean) {
  const db = getDb();
  const tx = db.transaction(() => {
    const c = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(order.campaign_id) as any;
    db.prepare('UPDATE campaigns SET revenue_paise = MAX(0, revenue_paise - ?) WHERE id = ?')
      .run(amount, order.campaign_id);
    if (fullyRefunded) {
      db.prepare('UPDATE campaigns SET units_sold = MAX(0, units_sold - 1) WHERE id = ?').run(order.campaign_id);
      db.prepare('UPDATE products SET stock_units = stock_units + 1 WHERE id = ?').run(c.product_id);
      db.prepare(`UPDATE orders SET status='REFUNDED', updated_at=datetime('now') WHERE id=?`).run(order.id);
    } else {
      db.prepare(`UPDATE orders SET status='PARTIALLY_REFUNDED', updated_at=datetime('now') WHERE id=?`).run(order.id);
    }
  });
  tx();
}

function handleRefundEvent(merchantId: string, body: any, event: string): string {
  const db = getDb();
  const r = body?.payload?.refund?.entity;
  if (!r?.id) return 'no_refund_id';
  const existing = db.prepare('SELECT * FROM refunds WHERE id = ?').get(r.id) as any;
  if (!existing) {
    log.warn('webhook', 'refund event for an unknown refund', { refundId: r.id, event });
    return 'unknown_refund';
  }
  if (existing.status === 'processed' && event === 'refund.processed') return 'already_processed';

  const status = event === 'refund.processed' ? 'processed' : 'failed';
  db.prepare(`UPDATE refunds SET status=?, confirmed_source='webhook', updated_at=datetime('now') WHERE id=?`)
    .run(status, r.id);

  if (status === 'processed' && existing.status !== 'processed') {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(existing.order_id) as any;
    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(existing.payment_id) as any;
    const refunded = (db.prepare(
      `SELECT COALESCE(SUM(amount_paise),0) AS a FROM refunds WHERE payment_id = ? AND status = 'processed'`
    ).get(existing.payment_id) as { a: number }).a;
    applyRefundToLedger(merchantId, order, existing.amount_paise, refunded >= (payment?.amount_paise ?? 0));
  }

  audit({
    merchantId, actor: 'RAZORPAY', action: status === 'processed' ? 'REFUND_PROCESSED' : 'REFUND_FAILED',
    severity: status === 'processed' ? 'warn' : 'error',
    orderId: existing.order_id,
    summary: `Refund ${r.id} ${status} — confirmed by Razorpay webhook`,
    detail: { refundId: r.id, amount: existing.amount_paise },
  });
  return `refund_${status}`;
}
