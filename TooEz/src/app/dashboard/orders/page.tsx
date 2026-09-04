'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, SectionHead, Chip, TableSkeleton, EmptyState, ErrorState, SearchInput, Segmented, ORDER_TONE, humanStatus, methodLabel } from '@/components/ui/kit';
import { Icon } from '@/components/ui/icons';
import { useApi, useLiveRefresh, inr, dateTime, downloadCsv } from '@/components/ui/data';
import { OrderDrawer } from '@/components/OrderDrawer';

const STATUSES = ['ALL', 'CREATED', 'AWAITING_CONFIRMATION', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'];
const RANGES = [{ value: 'today', label: 'Today' }, { value: '7d', label: '7d' }, { value: '30d', label: '30d' }, { value: '90d', label: '90d' }] as const;

function OrdersInner() {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [status, setStatus] = useState('ALL');
  const [range, setRange] = useState<'today' | '7d' | '30d' | '90d'>('30d');
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [debounced, setDebounced] = useState(q);

  useEffect(() => { const t = setTimeout(() => { setDebounced(q); setPage(0); }, 250); return () => clearTimeout(t); }, [q]);

  const limit = 25;
  const url = `/api/dashboard/orders?limit=${limit}&offset=${page * limit}&status=${status}&range=${range}` +
              (debounced ? `&q=${encodeURIComponent(debounced)}` : '');
  const { data, loading, error, reload } = useApi<any>(url, [url]);
  useLiveRefresh(useCallback(() => reload(true), [reload]));

  return (
    <div className="fade-up space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[21px] font-semibold tracking-[-0.02em] text-ink">Orders</h1>
          <p className="mt-1 text-[12.5px] text-ink-3">
            Every order the food app created, with its Razorpay mapping and current payment state.
          </p>
        </div>
        <button className="btn-ghost" disabled={!data?.rows?.length}
          onClick={() => downloadCsv('tooez-orders.csv', data.rows)}><Icon.Download /> Export CSV</button>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <SearchInput value={q} onChange={setQ} placeholder="Order id, Razorpay id, customer, item…" className="w-full sm:w-80" />
          <div className="flex flex-wrap items-center gap-2">
            <Segmented options={RANGES as any} value={range} onChange={(v: any) => { setRange(v); setPage(0); }} size="sm" />
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}
              aria-label="Filter by status" className="field !w-auto !py-1.5 text-[12px]">
              {STATUSES.map((s) => <option key={s} value={s}>{s === 'ALL' ? 'All statuses' : humanStatus(s)}</option>)}
            </select>
          </div>
          <span className="ml-auto text-[11.5px] tnum text-ink-3">
            {data ? `${data.total} order${data.total === 1 ? '' : 's'}` : ''}
          </span>
        </div>

        {error ? <ErrorState message={error} onRetry={() => reload()} />
          : loading && !data ? <TableSkeleton cols={7} />
          : !data.rows.length ? (
            <EmptyState title="No orders match these filters"
              hint={debounced || status !== 'ALL' ? 'Try clearing the search or widening the date range.'
                : 'Orders appear here the moment a customer opens an approved campaign and checks out.'}
              action={(debounced || status !== 'ALL') &&
                <button className="btn-ghost" onClick={() => { setQ(''); setStatus('ALL'); }}>Clear filters</button>} />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-line">
                    <th className="th">Order ID</th><th className="th">Customer</th><th className="th">Item</th>
                    <th className="th text-right">Amount</th><th className="th">Status</th>
                    <th className="th">Method</th><th className="th">Created</th><th className="th" />
                  </tr></thead>
                  <tbody>
                    {data.rows.map((o: any) => (
                      <tr key={o.id} className="tr-hover cursor-pointer border-b border-line last:border-0"
                        onClick={() => setOpen(o.id)}
                        tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(o.id)}>
                        <td className="td">
                          <div className="font-mono text-[11px] text-ink">{o.id}</div>
                          {o.razorpay_order_id && <div className="font-mono text-[10px] text-ink-4">{o.razorpay_order_id}</div>}
                        </td>
                        <td className="td">
                          <div className="text-ink">{o.customer_name || <span className="text-ink-4">Guest</span>}</div>
                          {o.customer_phone && <div className="text-[10.5px] tnum text-ink-4">{o.customer_phone}</div>}
                        </td>
                        <td className="td">{o.product_name}</td>
                        <td className="td text-right">
                          <div className="tnum font-medium text-ink">{inr(o.amount_paise)}</div>
                          {o.refunded_paise > 0 && <div className="text-[10.5px] tnum text-sand">−{inr(o.refunded_paise)} refunded</div>}
                        </td>
                        <td className="td">
                          <Chip tone={ORDER_TONE[o.status] ?? 'neutral'}>{humanStatus(o.status)}</Chip>
                          {o.attempt_no > 1 && <span className="ml-1.5 text-[10px] text-warn">retry #{o.attempt_no}</span>}
                        </td>
                        <td className="td text-ink-3">{methodLabel(o.payment_method)}</td>
                        <td className="td text-ink-3">{dateTime(o.created_at)}</td>
                        <td className="td text-ink-4"><Icon.Chevron size={14} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-line px-4 py-2.5">
                <span className="text-[11.5px] tnum text-ink-3">
                  {data.offset + 1}–{data.offset + data.rows.length} of {data.total}
                </span>
                <div className="flex gap-2">
                  <button className="btn-ghost !py-1.5 !text-[12px]" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
                  <button className="btn-ghost !py-1.5 !text-[12px]" disabled={!data.hasMore} onClick={() => setPage((p) => p + 1)}>Next</button>
                </div>
              </div>
            </>
          )}
      </Card>

      <OrderDrawer orderId={open} onClose={() => setOpen(null)} onChanged={() => reload(true)} />
    </div>
  );
}

export default function OrdersPage() {
  return <Suspense fallback={<TableSkeleton />}><OrdersInner /></Suspense>;
}
