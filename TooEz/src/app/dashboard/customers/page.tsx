'use client';

import { useCallback, useState } from 'react';
import { Card, SectionHead, TableSkeleton, EmptyState, ErrorState, SearchInput, Chip } from '@/components/ui/kit';
import { Icon } from '@/components/ui/icons';
import { useApi, useLiveRefresh, inr, dateTime, downloadCsv } from '@/components/ui/data';

export default function CustomersPage() {
  const [q, setQ] = useState('');
  const { data, loading, error, reload } = useApi<any>(`/api/dashboard/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`, [q]);
  useLiveRefresh(useCallback(() => reload(true), [reload]));

  const rows = data?.rows ?? [];
  const returning = rows.filter((r: any) => r.returning).length;
  const totalSpend = rows.reduce((s: number, r: any) => s + r.spend_paise, 0);

  return (
    <div className="fade-up space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[21px] font-semibold tracking-[-0.02em] text-ink">Customers</h1>
          <p className="mt-1 text-[12.5px] text-ink-3">
            Aggregated from your orders. TooEz has no separate customer record — this is the name and phone
            each person entered at checkout.
          </p>
        </div>
        <button className="btn-ghost" disabled={!rows.length}
          onClick={() => downloadCsv('tooez-customers.csv', rows)}><Icon.Download /> Export CSV</button>
      </div>

      {rows.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card glass className="p-4">
            <div className="label">Identified customers</div>
            <div className="mt-2 text-[24px] font-semibold leading-none tnum text-ink">{rows.length}</div>
          </Card>
          <Card glass className="p-4">
            <div className="label">Returning</div>
            <div className="mt-2 text-[24px] font-semibold leading-none tnum text-ink">{returning}</div>
            <div className="mt-1 text-[11px] text-ink-3">more than one order</div>
          </Card>
          <Card glass className="p-4">
            <div className="label">Total spend</div>
            <div className="mt-2 text-[24px] font-semibold leading-none tnum text-ink">{inr(totalSpend)}</div>
          </Card>
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <SearchInput value={q} onChange={setQ} placeholder="Name or phone…" className="w-full sm:w-72" />
          <span className="ml-auto text-[11.5px] tnum text-ink-3">{data ? `${data.total} customer${data.total === 1 ? '' : 's'}` : ''}</span>
        </div>

        {error ? <ErrorState message={error} onRetry={() => reload()} />
          : loading && !data ? <TableSkeleton cols={6} />
          : !rows.length ? (
            <EmptyState title="No customers yet" icon={<Icon.Customers size={26} />}
              hint="Customers appear once someone completes checkout and enters their name or phone. Both fields are optional, so guest orders are grouped separately." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-line">
                  <th className="th">Customer</th><th className="th text-right">Orders</th><th className="th text-right">Paid</th>
                  <th className="th text-right">Total spend</th><th className="th text-right">Avg order</th>
                  <th className="th">First order</th><th className="th">Last order</th>
                </tr></thead>
                <tbody>
                  {rows.map((c: any) => (
                    <tr key={c.customer_key} className="tr-hover border-b border-line last:border-0">
                      <td className="td">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand">
                            {(c.name ?? 'G').slice(0, 1).toUpperCase()}
                          </span>
                          <span>
                            <span className="block text-ink">{c.name || 'Guest'}</span>
                            {c.phone && <span className="block text-[10.5px] tnum text-ink-4">{c.phone}</span>}
                          </span>
                          {c.returning && <Chip tone="brand" className="ml-1">returning</Chip>}
                        </div>
                      </td>
                      <td className="td text-right tnum">{c.orders}</td>
                      <td className="td text-right tnum">{c.paid_orders}</td>
                      <td className="td text-right tnum font-medium text-ink">{inr(c.spend_paise)}</td>
                      <td className="td text-right tnum">{inr(c.avg_order_paise)}</td>
                      <td className="td text-ink-3">{dateTime(c.first_order_at)}</td>
                      <td className="td text-ink-3">{dateTime(c.last_order_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Card>

      {data?.note && <p className="text-[11px] leading-relaxed text-ink-4">{data.note}</p>}
    </div>
  );
}
