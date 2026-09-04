'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';

declare global { interface Window { Razorpay?: any } }

type Phase = 'loading' | 'ready' | 'opening' | 'awaiting' | 'paid' | 'failed' | 'unavailable';

const inr = (p: number) => '₹' + (p / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });

export default function Shop({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = use(params);
  const [data, setData] = useState<any>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [msg, setMsg] = useState<string | null>(null);
  const [order, setOrder] = useState<any>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const idemKey = useRef<string>('');

  if (!idemKey.current) {
    const stored = typeof window !== 'undefined' ? sessionStorage.getItem(`tooez_idem_${campaignId}`) : null;
    idemKey.current = stored || `cust_${Math.random().toString(36).slice(2, 14)}`;
    if (typeof window !== 'undefined') sessionStorage.setItem(`tooez_idem_${campaignId}`, idemKey.current);
  }

  const load = useCallback(async () => {
    const r = await fetch(`/api/shop/${campaignId}`, { cache: 'no-store' });
    if (!r.ok) { setPhase('unavailable'); setMsg('This offer link is not valid.'); return; }
    const j = await r.json();
    setData(j);
    if (j.campaign.status !== 'LIVE' && j.campaign.status !== 'COMPLETED') {
      setPhase('unavailable');
      setMsg(j.campaign.status === 'PENDING_APPROVAL'
        ? 'This offer is still awaiting the merchant’s approval.'
        : `This offer is ${j.campaign.status.toLowerCase().replace(/_/g, ' ')}.`);
      return;
    }
    if (j.remaining <= 0) { setPhase('unavailable'); setMsg('This offer is sold out.'); return; }
    setPhase((p) => (p === 'loading' ? 'ready' : p));
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  // Razorpay Checkout script, loaded once and awaited properly. Without this a
  // fast click on "Buy now" raced the script tag and produced a confusing error.
  const checkoutScript = useRef<Promise<void> | null>(null);
  const loadCheckout = useCallback(() => {
    if (checkoutScript.current) return checkoutScript.current;
    checkoutScript.current = new Promise<void>((resolve, reject) => {
      if (typeof window !== 'undefined' && window.Razorpay) return resolve();
      const existing = document.getElementById('rzp-checkout') as HTMLScriptElement | null;
      const el = existing ?? document.createElement('script');
      if (!existing) {
        el.id = 'rzp-checkout';
        el.src = 'https://checkout.razorpay.com/v1/checkout.js';
        el.async = true;
        document.body.appendChild(el);
      }
      el.addEventListener('load', () => resolve());
      el.addEventListener('error', () => reject(new Error('blocked')));
      setTimeout(() => (window.Razorpay ? resolve() : reject(new Error('timeout'))), 15000);
    });
    return checkoutScript.current;
  }, []);
  useEffect(() => { loadCheckout().catch(() => { /* surfaced on Buy now */ }); }, [loadCheckout]);

  // Countdown
  useEffect(() => {
    if (!data?.campaign?.expires_at) return;
    const target = new Date(data.campaign.expires_at.replace(' ', 'T') + 'Z').getTime();
    const t = setInterval(() => setSecondsLeft(Math.max(0, Math.round((target - Date.now()) / 1000))), 500);
    return () => clearInterval(t);
  }, [data]);

  // Poll for webhook confirmation once we're awaiting.
  useEffect(() => {
    if (phase !== 'awaiting' || !order) return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/shop/${campaignId}`, { cache: 'no-store' });
      const j = await r.json();
      if (j.campaign.units_sold > (data?.campaign?.units_sold ?? 0)) { setPhase('paid'); clearInterval(t); }
    }, 1500);
    const stop = setTimeout(() => clearInterval(t), 60000);
    return () => { clearInterval(t); clearTimeout(stop); };
  }, [phase, order, campaignId, data]);

  const buy = async () => {
    setPhase('opening'); setMsg(null);
    const r = await fetch('/api/orders/create', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        campaignId, idempotencyKey: idemKey.current,
        customerRef: phone.trim() || 'guest',
        customerName: name.trim() || undefined,
        customerPhone: phone.trim() || undefined,
      }),
    });
    const j = await r.json();
    if (!r.ok) { setPhase('failed'); setMsg(j.error ?? 'Could not create the order.'); return; }
    setOrder(j);

    if (j.gateway === 'mock') { setPhase('awaiting'); return; }

    try {
      await loadCheckout();
    } catch {
      setPhase('failed');
      setMsg('Razorpay Checkout could not load (checkout.razorpay.com is unreachable — check your network, ad-blocker or firewall). Your order was created and no payment was attempted.');
      return;
    }

    const rz = new window.Razorpay({
      key: j.keyId,
      amount: j.amountPaise,
      currency: 'INR',
      name: data.campaign.merchant_name,
      description: data.campaign.product_name,
      order_id: j.razorpayOrderId,
      prefill: { name: name.trim() || undefined, contact: phone.trim() || undefined },
      theme: { color: '#5b8def' },
      handler: async (res: any) => {
        setPhase('awaiting');
        // The server verifies the signature AND asks Razorpay directly.
        const cr = await fetch('/api/payments/confirm', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(res),
        }).then((x) => x.json()).catch(() => ({}));
        if (cr?.status === 'PAID') { setPhase('paid'); await load(); }
      },
      modal: {
        ondismiss: () => { setPhase('ready'); setMsg('Checkout closed before payment completed.'); },
      },
    });
    rz.on('payment.failed', (res: any) => {
      setPhase('failed');
      setMsg(res?.error?.description ?? 'Payment failed.');
    });
    rz.open();
  };

  const mockPay = async (outcome: 'success' | 'fail') => {
    if (!order) return;
    setPhase('awaiting'); setMsg(null);
    const r = await fetch('/api/dev/mock-payment', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ razorpayOrderId: order.razorpayOrderId, outcome }),
    });
    const j = await r.json();
    if (outcome === 'fail') { setPhase('failed'); setMsg('Payment failed — insufficient balance in the customer VPA.'); }
    else if (j.result === 'captured') { setPhase('paid'); }
    else { setPhase('failed'); setMsg(`Gateway returned: ${j.result}`); }
    await load();
  };

  const retry = async () => {
    if (!order) { setPhase('ready'); return; }
    const r = await fetch('/api/orders/retry', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId: order.orderId }),
    });
    const j = await r.json();
    if (!r.ok) { setMsg(j.error); return; }
    setOrder(j); setPhase('ready'); setMsg('New order created for the retry. The failed order stays failed — never reused.');
  };

  if (phase === 'loading') {
    return <Shell><div className="skeleton h-56 rounded-xl" /></Shell>;
  }

  const c = data?.campaign;
  const saving = c ? c.list_price_paise - c.price_paise : 0;

  return (
    <Shell>
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-[12px] font-bold text-white">T</div>
          <span className="text-[13px] font-medium text-ink-2">{c?.merchant_name ?? 'TooEz'}</span>
        </div>
        {data?.gateway.mode === 'mock'
          ? <span className="chip border-warn-border bg-warn-soft text-warn">MOCK GATEWAY</span>
          : <span className="chip border-brand-border bg-brand-soft text-brand">
              Razorpay {data?.gateway.testMode ? 'TEST' : 'LIVE'}
            </span>}
      </div>

      {phase === 'unavailable' ? (
        <div className="card card-pad text-center">
          <div className="text-[15px] font-medium text-ink">Offer unavailable</div>
          <p className="mt-1.5 text-[12.5px] text-ink-3">{msg}</p>
        </div>
      ) : phase === 'paid' ? (
        <div className="card card-pad text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-good/15 text-[22px] text-good">✓</div>
          <div className="text-[17px] font-semibold text-ink">Payment confirmed</div>
          <p className="mx-auto mt-2 max-w-sm text-[12.5px] leading-relaxed text-ink-3">
            {inr(c.price_paise)} captured. Confirmation came from Razorpay&apos;s webhook, not from this page —
            the merchant dashboard has already booked the revenue.
          </p>
          <div className="mt-4 rounded-lg border border-line bg-surface/60 px-3 py-2 text-left font-mono text-[10.5px] text-ink-3">
            <div>order&nbsp;&nbsp;{order?.orderId}</div>
            <div>rzp&nbsp;&nbsp;&nbsp;&nbsp;{order?.razorpayOrderId}</div>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="border-b border-line/70 bg-brand-soft px-5 py-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-brand">Recommended for you</span>
          </div>

          <div className="card-pad">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-[19px] font-semibold leading-tight text-ink">{c.product_name}</h1>
                <p className="mt-0.5 text-[11.5px] capitalize text-ink-3">{c.category}</p>
              </div>
              {secondsLeft !== null && secondsLeft > 0 && (
                <div className="shrink-0 rounded-lg border border-warn-border bg-warn-soft px-2.5 py-1.5 text-center">
                  <div className="text-[13px] font-semibold tnum text-warn">
                    {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
                  </div>
                  <div className="text-[9px] uppercase tracking-wider text-warn">left</div>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-[34px] font-semibold leading-none tnum text-ink">{inr(c.price_paise)}</span>
              <span className="text-[15px] tnum text-ink-4 line-through">{inr(c.list_price_paise)}</span>
              <span className="chip border-good-border bg-good-soft text-good">save {inr(saving)}</span>
            </div>

            <p className="mt-3 text-[12.5px] text-ink-2">
              Available for the next {c.window_minutes} minutes · {data.remaining} left
            </p>

            {msg && (
              <div className={`mt-4 rounded-lg border px-3.5 py-2.5 text-[12px] ${
                phase === 'failed' ? 'border-bad-border bg-bad-soft text-bad' : 'border-line bg-surface/60 text-ink-2'}`}>
                {msg}
              </div>
            )}

            {phase === 'awaiting' && (
              <div className="mt-4 rounded-lg border border-warn-border bg-warn-soft px-3.5 py-3">
                <div className="flex items-center gap-2 text-[12.5px] font-medium text-warn">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warn" />
                  Waiting for Razorpay to confirm capture
                </div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-ink-3">
                  Your browser said the payment succeeded. TooEz does not trust that — it waits for the signed
                  webhook before booking any revenue.
                </p>
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-2">
              <label className="col-span-1">
                <span className="label">Your name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional"
                  className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink
                             outline-none transition-colors placeholder:text-ink-4 focus:border-brand" />
              </label>
              <label className="col-span-1">
                <span className="label">Phone</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9+]/g, ''))}
                  inputMode="tel" placeholder="Optional"
                  className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] tnum text-ink
                             outline-none transition-colors placeholder:text-ink-4 focus:border-brand" />
              </label>
              <p className="col-span-2 text-[10.5px] leading-relaxed text-ink-4">
                Used to identify your order on the merchant&apos;s dashboard. Stored locally by TooEz — never sent to
                the payment gateway beyond Razorpay&apos;s own checkout prefill.
              </p>
            </div>

            <div className="mt-3 space-y-2">
              {phase === 'failed' ? (
                <button className="btn-primary w-full !py-3 !text-[14px]" onClick={retry}>Try again</button>
              ) : (
                <button className="btn-primary w-full !py-3 !text-[14px]" onClick={buy}
                  disabled={phase === 'opening' || phase === 'awaiting'}>
                  {phase === 'opening' ? 'Opening checkout…' : phase === 'awaiting' ? 'Confirming…' : `Buy now · ${inr(c.price_paise)}`}
                </button>
              )}

              {data.gateway.mode === 'mock' && order && (
                <div className="rounded-lg border border-warn-border bg-warn-soft p-3">
                  <div className="text-[10.5px] font-semibold uppercase tracking-wider text-warn">
                    Mock gateway — development only
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-ink-3">
                    No Razorpay keys are configured, so this simulates the gateway. It still emits a Razorpay-shaped
                    webhook through the real settlement code path — the browser never marks anything paid.
                  </p>
                  <div className="mt-2.5 flex gap-2">
                    <button className="btn-good flex-1 !py-2 !text-[12px]" onClick={() => mockPay('success')}>
                      Simulate successful payment
                    </button>
                    <button className="btn-bad flex-1 !py-2 !text-[12px]" onClick={() => mockPay('fail')}>
                      Simulate failure
                    </button>
                  </div>
                </div>
              )}
            </div>

            {data.gateway.mode === 'razorpay' && data.gateway.testMode && (
              <p className="mt-3 text-center text-[10.5px] leading-relaxed text-ink-4">
                Razorpay test mode. Use card 4111 1111 1111 1111, any future expiry, any CVV, OTP 1111 —
                or UPI id <code className="text-ink-2">success@razorpay</code> / <code className="text-ink-2">failure@razorpay</code>.
              </p>
            )}
          </div>
        </div>
      )}

      <p className="mt-5 text-center text-[10.5px] leading-relaxed text-ink-4">
        This price was set by TooEz&apos;s Offer Agent, cleared by an independent Risk Agent against the merchant&apos;s
        margin policy, and approved by the merchant before it went live.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-md px-5 py-10">{children}</main>;
}
