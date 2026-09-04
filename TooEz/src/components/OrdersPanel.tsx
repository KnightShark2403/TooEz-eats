'use client';
import { useState } from 'react';
import { Chip, SectionTitle, Empty } from './primitives';
import { inr, clockTime } from './format';

const TONE: Record<string, 'neutral' | 'good' | 'bad' | 'warn' | 'accent'> = {
  CREATED: 'neutral',
  AWAITING_CONFIRMATION: 'warn',
  PAID: 'good',
  FAILED: 'bad',
  ABANDONED: 'neutral',
};

export function OrdersPanel({ orders, onChanged, gateway }: { orders: any[]; onChanged: () => void; gateway: any }) {
  const [busy, setBusy] = useState<string | null>(null);

  const post = async (url: string, body: unknown, key: string) => {
    setBusy(key);
    try {
      await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      onChanged();
    } finally { setBusy(null); }
  };

  if (!orders.length) {
    return <Empty title="No orders yet" hint="Orders appear the moment a customer opens an approved campaign's checkout." />;
  }

  return (
    <div className="card">
      <div className="border-b border-ink-700/70 px-4 py-2.5">
        <SectionTitle right={<Chip tone={gateway.mode === 'razorpay' ? 'accent' : 'warn'}>
          {gateway.mode === 'razorpay' ? (gateway.testMode ? 'Razorpay test mode' : 'Razorpay live') : 'Mock gateway'}
        </Chip>}>
          Payment ledger
        </SectionTitle>
        <p className="text-[11px] leading-relaxed text-ink-400">
          An order only reaches <b className="text-good">PAID</b> through a signature-verified Razorpay webhook or a
          server-side API reconcile. The browser can move it no further than <b className="text-warn">AWAITING&nbsp;CONFIRMATION</b>.
        </p>
      </div>
      <div className="max-h-[420px] divide-y divide-ink-800 overflow-y-auto">
        {orders.map((o) => (
          <div key={o.id} className="px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={TONE[o.status] ?? 'neutral'}>{o.status.replace(/_/g, ' ')}</Chip>
                  <span className="text-[13px] font-medium tnum text-ink-100">{inr(o.amount_paise)}</span>
                  <span className="text-[11.5px] text-ink-300">{o.product_name}</span>
                  {o.attempt_no > 1 && <Chip tone="warn">retry #{o.attempt_no}</Chip>}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 font-mono text-[10px] text-ink-500">
                  <span>{o.id}</span>
                  {o.razorpay_order_id && <span>{o.razorpay_order_id}</span>}
                  <span>{clockTime(o.created_at)}</span>
                </div>
                {o.failure_reason && (
                  <div className="mt-1 text-[11px] text-bad">✕ {o.failure_reason}</div>
                )}
              </div>
              <div className="flex gap-2">
                {o.status === 'AWAITING_CONFIRMATION' && gateway.mode === 'razorpay' && (
                  <button className="btn-ghost !py-1.5 !text-[11.5px]" disabled={busy === o.id}
                    onClick={() => post('/api/orders/reconcile', { orderId: o.id }, o.id)}>
                    {busy === o.id ? 'Checking…' : 'Reconcile with Razorpay'}
                  </button>
                )}
                {o.status === 'FAILED' && (
                  <button className="btn-primary !py-1.5 !text-[11.5px]" disabled={busy === o.id}
                    onClick={() => post('/api/orders/retry', { orderId: o.id }, o.id)}>
                    {busy === o.id ? 'Retrying…' : 'Retry payment'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
