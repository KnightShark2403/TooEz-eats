'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, SectionHead, Chip, TableSkeleton, EmptyState, ErrorState, SearchInput, PAYMENT_TONE, methodLabel } from '@/components/ui/kit';
import { Icon } from '@/components/ui/icons';
import { useApi, useLiveRefresh, inr, dateTime, pct, downloadCsv } from '@/components/ui/data';
import { OrderDrawer } from '@/components/OrderDrawer';

function PaymentsInner() {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [debounced, setDebounced] = useState(q);
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { const t = setTimeout(() => { setDebounced(q); setPage(0); }, 250); return () => clearTimeout(t); }, [q]);

  const limit = 25;
  const url = `/api/dashboard/payments?limit=${limit}&offset=${page * limit}&status=${status}` +
              (debounced ? `&q=${encodeURIComponent(debounced)}` : '');
  const { data, loading, error, reload } = useApi<any>(url, [url]);
  useLiveRefresh(useCallback(() => reload(true), [reload]));

  const totalCaptured = (data?.methods ?? []).reduce((s: number, m: any) => s + m.amount, 0);

  return (
    <div className="fade-up space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[21px] font-semibold tracking-[-0.02em] text-ink">Payments</h1>
          <p className="mt-1 text-[12.5px] text-ink-3">
            The Razorpay ledger as TooEz recorded it. Every row was written by a signature-verified webhook
            or a server-side API reconcile — never by a browser.
          </p>
        </div>
        <button className="btn-ghost" disabled={!data?.rows?.length}
          onClick={() => downloadCsv('tooez-payments.csv', data.rows)}><Icon.Download /> Export CSV</button>
      </div>

      {data?.methods?.length > 0 && (
        <Card className="card-pad">
          <SectionHead title="Payment methods" subtitle="Captured payments by the method Razorpay reported." />
          <div className="flex flex-wrap gap-2">
            {data.methods.map((m: any) => (
              <div key={m.method} className="rounded-lg border border-line bg-surface-2 px-3 py-2">
                <div className="text-[11px] uppercase tracking-wider text-ink-3">{methodLabel(m.method)}</div>
                <div className="mt-1 text-[15px] font-semibold tnum text-ink">{inr(m.amount)}</div>
                <div className="text-[10.5px] tnum text-ink-4">
                  {m.n} payment{m.n === 1 ? '' : 's'} · {pct(totalCaptured ? (m.amount / totalCaptured) * 100 : 0, 0)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <SearchInput value={q} onChange={setQ} placeholder="Payment id, order id, customer…" className="w-full sm:w-80" />
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}
            aria-label="Filter by payment status" className="field !w-auto !py-1.5 text-[12px]">
            {['ALL', 'captured', 'failed', 'authorized'].map((s) => (
              <option key={s} value={s}>{s === 'ALL' ? 'All statuses' : s}</option>
            ))}
          </select>
          <span className="ml-auto text-[11.5px] tnum text-ink-3">{data ? `${data.total} payment${data.total === 1 ? '' : 's'}` : ''}</span>
        </div>

        {error ? <ErrorState message={error} onRetry={() => reload()} />
          : loading && !data ? <TableSkeleton cols={7} />
          : !data.rows.length ? (
            <EmptyState title="No payments recorded yet"
              hint="A payment row is created only when Razorpay confirms the outcome. Place a test order from a live campaign to see one here."
              icon={<Icon.Payments size={26} />} />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-line">
                    <th className="th">Razorpay payment</th><th className="th">Razorpay order</th><th className="th">TooEz order</th>
                    <th className="th">Customer</th><th className="th text-right">Amount</th>
                    <th className="th">Status</th><th className="th">Method</th><th className="th">Confirmed by</th><th className="th">Time</th>
                  </tr></thead>
                  <tbody>
                    {data.rows.map((p: any) => (
                      <tr key={p.razorpay_payment_id} className="tr-hover cursor-pointer border-b border-line last:border-0"
                        onClick={() => setOpen(p.tooez_order_id)} tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && setOpen(p.tooez_order_id)}>
                        <td className="td font-mono text-[11px] text-ink">{p.razorpay_payment_id}</td>
                        <td className="td font-mono text-[11px] text-ink-3">{p.razorpay_order_id ?? '—'}</td>
                        <td className="td font-mono text-[11px] text-ink-3">{p.tooez_order_id}</td>
                        <td className="td">{p.customer_name || <span className="text-ink-4">Guest</span>}</td>
                        <td className="td text-right">
                          <div className="tnum font-medium text-ink">{inr(p.amount_paise)}</div>
                          {p.refunded_paise > 0 && <div className="text-[10.5px] tnum text-sand">−{inr(p.refunded_paise)}</div>}
                        </td>
                        <td className="td">
                          <Chip tone={PAYMENT_TONE[p.status] ?? 'neutral'}>{p.status}</Chip>
                          {p.error_description && <div className="mt-1 max-w-[220px] truncate text-[10.5px] text-bad">{p.error_description}</div>}
                        </td>
                        <td className="td text-ink-3">{methodLabel(p.method)}</td>
                        <td className="td text-ink-3">{p.confirmed_source === 'webhook' ? 'Webhook' : 'API reconcile'}</td>
                        <td className="td text-ink-3">{dateTime(p.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-line px-4 py-2.5">
                <span className="text-[11.5px] tnum text-ink-3">{data.offset + 1}–{data.offset + data.rows.length} of {data.total}</span>
                <div className="flex gap-2">
                  <button className="btn-ghost !py-1.5 !text-[12px]" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
                  <button className="btn-ghost !py-1.5 !text-[12px]" disabled={!data.hasMore} onClick={() => setPage((p) => p + 1)}>Next</button>
                </div>
              </div>
            </>
          )}
      </Card>

      <p className="text-[11px] leading-relaxed text-ink-4">
        The dashboard reads this ledger from the TooEz backend. It never calls Razorpay, and no Razorpay secret
        is ever sent to the browser — only the public key id, and only on the customer checkout page.
      </p>

      <OrderDrawer orderId={open} onClose={() => setOpen(null)} onChanged={() => reload(true)} />
    </div>
  );
}

export default function PaymentsPage() {
  return <Suspense fallback={<TableSkeleton />}><PaymentsInner /></Suspense>;
}
