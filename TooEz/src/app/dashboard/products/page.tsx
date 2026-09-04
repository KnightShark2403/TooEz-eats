'use client';

import { useCallback } from 'react';
import { Card, SectionHead, Chip, TableSkeleton, EmptyState, ErrorState, Meter } from '@/components/ui/kit';
import { Icon } from '@/components/ui/icons';
import { useApi, useLiveRefresh, inr, pct, downloadCsv } from '@/components/ui/data';

export default function ProductsPage() {
  const { data, loading, error, reload } = useApi<any>('/api/dashboard/products');
  useLiveRefresh(useCallback(() => reload(true), [reload]));
  const rows = data?.rows ?? [];

  return (
    <div className="fade-up space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[21px] font-semibold tracking-[-0.02em] text-ink">Products</h1>
          <p className="mt-1 text-[12.5px] text-ink-3">
            Your menu, live stock, and what each item has actually earned. Unit cost is what the Risk Agent
            uses to protect your margin.
          </p>
        </div>
        <button className="btn-ghost" disabled={!rows.length}
          onClick={() => downloadCsv('tooez-products.csv', rows)}><Icon.Download /> Export CSV</button>
      </div>

      {error ? <Card><ErrorState message={error} onRetry={() => reload()} /></Card>
        : loading && !data ? <Card><TableSkeleton cols={6} /></Card>
        : !rows.length ? <Card><EmptyState title="No products" icon={<Icon.Products size={26} />} /></Card>
        : (
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {rows.map((p: any) => (
              <Card key={p.id} className="card-pad">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-[14px] font-semibold text-ink">{p.name}</h3>
                    <p className="mt-0.5 font-mono text-[10.5px] text-ink-4">{p.sku} · {p.category}</p>
                  </div>
                  <Chip tone={p.stock_units > 5 ? 'good' : p.stock_units > 0 ? 'warn' : 'bad'}>
                    {p.stock_units} in stock
                  </Chip>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 border-y border-line py-3">
                  <Cell k="List price" v={inr(p.list_price_paise)} />
                  <Cell k="Unit cost" v={inr(p.cogs_paise)} />
                  <Cell k="Margin at list" v={pct(p.margin_pct_at_list, 0)} />
                </div>

                <div className="mt-3">
                  <div className="mb-1 flex items-baseline justify-between text-[11.5px]">
                    <span className="text-ink-3">Revenue to date</span>
                    <span className="tnum font-medium text-ink">{inr(p.total_revenue_paise)}</span>
                  </div>
                  <Meter value={p.share_pct} max={100} tone="brand" />
                  <div className="mt-1.5 flex justify-between text-[10.5px] text-ink-4">
                    <span>{p.total_units} units sold</span>
                    <span>{inr(p.agent_revenue_paise)} from campaigns</span>
                  </div>
                </div>

                {p.perishable === 1 && (
                  <div className="mt-3 flex items-center gap-1.5 text-[10.5px] text-ink-3">
                    <Icon.Alert size={13} /> Perishable · {p.shelf_life_min} min shelf life
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

      <p className="text-[11px] leading-relaxed text-ink-4">
        Editing the menu is not exposed in this build — products, stock and unit costs come from the seeded merchant
        record and would be synced from a POS in production.
      </p>
    </div>
  );
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-wider text-ink-4">{k}</div>
      <div className="mt-0.5 text-[13px] font-medium tnum text-ink">{v}</div>
    </div>
  );
}
