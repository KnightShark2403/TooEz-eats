'use client';

import { useEffect, useState } from 'react';
import { Chip, Skeleton, ErrorState, ORDER_TONE, PAYMENT_TONE, humanStatus, methodLabel } from '@/components/ui/kit';
import { Icon } from '@/components/ui/icons';
import { inr, dateTime, clockTime } from '@/components/ui/data';

/**
 * Order detail, including the full TooEz ↔ Razorpay mapping and the refund
 * action. The refund is performed by the backend — the browser only asks.
 */
export function OrderDrawer({ orderId, onClose, onChanged }: {
  orderId: string | null; onClose: () => void; onChanged: () => void;
}) {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);

  const load = async () => {
    if (!orderId) return;
    setLoading(true); setErr(null);
    try {
      const r = await fetch(`/api/dashboard/orders/${orderId}`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Could not load the order');
      setD(j);
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  };

  useEffect(() => { setD(null); setNotice(null); load(); /* eslint-disable-next-line */ }, [orderId]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  if (!orderId) return null;

  const act = async (url: string, body: unknown, key: string, okText: string) => {
    setBusy(key); setNotice(null);
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Request failed');
      setNotice({ tone: 'good', text: okText });
      await load(); onChanged();
    } catch (e: any) { setNotice({ tone: 'bad', text: e.message }); } finally { setBusy(null); }
  };

  const o = d?.order;
  const refundable = o && o.status === 'PAID';
  const awaiting = o && o.status === 'AWAITING_CONFIRMATION';
  const failed = o && o.status === 'FAILED';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <aside role="dialog" aria-modal="true" aria-label="Order details"
        className="fade-up fixed inset-y-0 right-0 z-50 flex w-full max-w-[520px] flex-col border-l border-line bg-surface shadow-lg">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Order details</h2>
            <p className="font-mono text-[11px] text-ink-3">{orderId}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink">
            <Icon.Close />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && !d && <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>}
          {err && <ErrorState message={err} onRetry={load} />}

          {o && (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[26px] font-semibold leading-none tnum text-ink">{inr(o.amount_paise)}</div>
                  <div className="mt-1.5 text-[12.5px] text-ink-2">{o.product_name}</div>
                </div>
                <Chip tone={ORDER_TONE[o.status] ?? 'neutral'}>{humanStatus(o.status)}</Chip>
              </div>

              {notice && (
                <div className={`rounded-lg border px-3 py-2 text-[12px] ${
                  notice.tone === 'good' ? 'border-good-border bg-good-soft text-good' : 'border-bad-border bg-bad-soft text-bad'}`}>
                  {notice.text}
                </div>
              )}

              <Section title="Payment mapping">
                <KV k="TooEz order" v={o.id} mono />
                <KV k="Razorpay order" v={o.razorpay_order_id ?? '—'} mono />
                <KV k="Razorpay payment" v={d.payments[0]?.id ?? '—'} mono />
                <KV k="Gateway" v={o.gateway === 'razorpay' ? 'Razorpay (test)' : 'Mock (development)'} />
                <KV k="Method" v={methodLabel(o.payment_method)} />
                <KV k="Confirmed by" v={d.payments[0]?.confirmed_source ?? '—'} />
              </Section>

              <Section title="Customer">
                <KV k="Name" v={o.customer_name ?? 'Guest'} />
                <KV k="Phone" v={o.customer_phone ?? '—'} />
              </Section>

              <Section title="Timing">
                <KV k="Created" v={dateTime(o.created_at)} />
                <KV k="Captured" v={o.captured_at ? dateTime(o.captured_at) : '—'} />
                <KV k="Updated" v={dateTime(o.updated_at)} />
              </Section>

              {o.failure_reason && (
                <div className="rounded-lg border border-bad-border bg-bad-soft px-3 py-2.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-bad">Decline reason</div>
                  <div className="mt-1 text-[12.5px] text-ink-2">{o.failure_reason}</div>
                  {o.failure_code && <div className="mt-0.5 font-mono text-[10.5px] text-ink-4">{o.failure_code}</div>}
                </div>
              )}

              {d.refunds?.length > 0 && (
                <Section title="Refunds">
                  {d.refunds.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between border-b border-line py-1.5 last:border-0">
                      <span className="font-mono text-[11px] text-ink-2">{r.id}</span>
                      <span className="flex items-center gap-2">
                        <span className="tnum text-[12px] text-ink">{inr(r.amount_paise)}</span>
                        <Chip tone={r.status === 'processed' ? 'good' : r.status === 'failed' ? 'bad' : 'warn'}>{r.status}</Chip>
                      </span>
                    </div>
                  ))}
                </Section>
              )}

              {d.payments?.length > 0 && (
                <Section title="Payment attempts">
                  {d.payments.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between border-b border-line py-1.5 last:border-0">
                      <span className="font-mono text-[11px] text-ink-2">{p.id}</span>
                      <span className="flex items-center gap-2">
                        <span className="tnum text-[12px] text-ink">{inr(p.amount_paise)}</span>
                        <Chip tone={PAYMENT_TONE[p.status] ?? 'neutral'}>{p.status}</Chip>
                      </span>
                    </div>
                  ))}
                </Section>
              )}

              {d.timeline?.length > 0 && (
                <Section title="Audit trail">
                  <ol className="space-y-2">
                    {d.timeline.map((t: any) => (
                      <li key={t.id} className="flex gap-3">
                        <span className="w-[62px] shrink-0 font-mono text-[10.5px] tnum text-ink-4">{clockTime(t.ts)}</span>
                        <span className={`text-[11.5px] leading-snug ${
                          t.severity === 'error' || t.severity === 'veto' ? 'text-bad'
                          : t.severity === 'success' ? 'text-good'
                          : t.severity === 'warn' ? 'text-warn' : 'text-ink-2'}`}>{t.summary}</span>
                      </li>
                    ))}
                  </ol>
                </Section>
              )}
            </div>
          )}
        </div>

        {o && (
          <div className="flex flex-wrap gap-2 border-t border-line px-5 py-3.5">
            {awaiting && (
              <button className="btn-ghost" disabled={!!busy}
                onClick={() => act('/api/orders/reconcile', { orderId: o.id }, 'rec', 'Reconciled against the Razorpay API.')}>
                <Icon.Refresh /> {busy === 'rec' ? 'Checking…' : 'Reconcile with Razorpay'}
              </button>
            )}
            {failed && (
              <button className="btn-primary" disabled={!!busy}
                onClick={() => act('/api/orders/retry', { orderId: o.id }, 'retry', 'A new order was created for the retry.')}>
                <Icon.Refresh /> {busy === 'retry' ? 'Retrying…' : 'Retry payment'}
              </button>
            )}
            {refundable && (
              <button className="btn-bad" disabled={!!busy}
                onClick={() => {
                  if (!confirm(`Refund ${inr(o.amount_paise)} to the customer? This calls Razorpay and cannot be undone.`)) return;
                  act('/api/orders/refund',
                    { orderId: o.id, reason: 'Refunded from the TooEz dashboard', idempotencyKey: `rf_${o.id}` },
                    'refund', 'Refund submitted to Razorpay.');
                }}>
                <Icon.Refund /> {busy === 'refund' ? 'Refunding…' : 'Issue refund'}
              </button>
            )}
            <button className="btn-ghost ml-auto" onClick={onClose}>Close</button>
          </div>
        )}
      </aside>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="label mb-1.5">{title}</h3>
      <div className="rounded-lg border border-line bg-surface-2 px-3 py-2">{children}</div>
    </section>
  );
}

function KV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-1.5 last:border-0">
      <span className="shrink-0 text-[11.5px] text-ink-3">{k}</span>
      <span className={`truncate text-right text-[12px] text-ink ${mono ? 'font-mono text-[11px]' : ''}`}>{v}</span>
    </div>
  );
}
