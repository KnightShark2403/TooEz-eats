'use client';

import { useCallback, useState } from 'react';
import { Card, SectionHead, TableSkeleton, EmptyState, ErrorState, Segmented, Chip, humanStatus, methodLabel } from '@/components/ui/kit';
import { RevenueChart, Donut, BarList, HourlyBars } from '@/components/ui/charts';
import { Icon } from '@/components/ui/icons';
import { useApi, useLiveRefresh, inr, pct, downloadCsv } from '@/components/ui/data';

type Range = '7d' | '30d' | '90d';
const RANGES = [{ value: '7d', label: '7 days' }, { value: '30d', label: '30 days' }, { value: '90d', label: '90 days' }] as const;

const STATUS_COLOR: Record<string, string> = {
  PAID: 'var(--good)', CREATED: 'var(--brand)', AWAITING_CONFIRMATION: 'var(--warn)',
  FAILED: 'var(--bad)', REFUNDED: 'var(--sand)', PARTIALLY_REFUNDED: 'var(--sand)', ABANDONED: 'var(--text-4)',
};

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>('30d');
  const { data, loading, error, reload } = useApi<any>(`/api/dashboard/analytics?range=${range}`, [range]);
  useLiveRefresh(useCallback(() => reload(true), [reload]));

  if (error) return <Card><ErrorState message={error} onRetry={() => reload()} /></Card>;
  if (loading && !data) return <div className="space-y-4"><TableSkeleton rows={10} /></div>;

  const statusTotal = data.orderStatus.reduce((s: number, x: any) => s + x.n, 0);
  const paid = data.orderStatus.find((s: any) => s.status === 'PAID')?.n ?? 0;
  const methodTotal = data.paymentMethods.reduce((s: number, m: any) => s + m.amount, 0);
  const hasData = statusTotal > 0;

  return (
    <div className="fade-up space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[21px] font-semibold tracking-[-0.02em] text-ink">Analytics</h1>
          <p className="mt-1 text-[12.5px] text-ink-3">
            Only metrics TooEz can actually compute from your orders, payments and agent decisions.
          </p>
        </div>
        <div className="flex gap-2">
          <Segmented options={RANGES as any} value={range} onChange={(v: any) => setRange(v)} />
          <button className="btn-ghost" onClick={() => downloadCsv(`tooez-analytics-${range}.csv`, data.series)}>
            <Icon.Download /> Export
          </button>
        </div>
      </div>

      {!hasData && (
        <Card><EmptyState title="Not enough data yet" icon={<Icon.Analytics size={26} />}
          hint="Analytics fill in as orders and payments accumulate. Nothing here is simulated, so the panels stay empty until there is something real to show." /></Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Average order value" value={inr(data.averageOrderValuePaise)} hint="paid orders only" />
        <Metric label="Payment success rate" value={statusTotal ? pct((paid / statusTotal) * 100) : '—'}
          hint={`${paid} of ${statusTotal} attempts`} tone="good" />
        <Metric label="Campaign revenue" value={inr(data.agentImpact.campaign_revenue_paise)}
          hint={`${data.agentImpact.campaigns} campaigns`} tone="brand" />
        <Metric label="Discount cost" value={inr(data.agentImpact.discount_cost_paise)}
          hint="subsidy committed by the agents" tone="sand" />
      </div>

      <Card className="card-pad">
        <SectionHead title="Revenue trend" subtitle="Total and agent-driven revenue by day." />
        {data.series?.length ? <RevenueChart data={data.series} height={220} /> : <EmptyState title="No revenue yet" />}
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="card-pad">
          <SectionHead title="Order status" />
          {hasData ? (
            <div className="flex flex-col items-center gap-4">
              <Donut size={150}
                slices={data.orderStatus.map((s: any) => ({ label: humanStatus(s.status), value: s.n, tone: STATUS_COLOR[s.status] ?? 'var(--text-4)' }))}
                total={statusTotal} />
              <div className="w-full space-y-1.5">
                {data.orderStatus.map((s: any) => (
                  <div key={s.status} className="flex items-center gap-2.5 text-[12px]">
                    <span className="h-2 w-2 rounded-sm" style={{ background: STATUS_COLOR[s.status] ?? 'var(--text-4)' }} />
                    <span className="flex-1 text-ink-2">{humanStatus(s.status)}</span>
                    <span className="tnum text-ink">{s.n}</span>
                    <span className="w-12 text-right tnum text-ink-4">{inr(s.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <EmptyState title="No orders in this range" />}
        </Card>

        <Card className="card-pad">
          <SectionHead title="Payment methods" subtitle="Captured payments, as Razorpay reported them." />
          {data.paymentMethods.length ? (
            <BarList items={data.paymentMethods.map((m: any) => ({
              label: methodLabel(m.method), value: inr(m.amount),
              pct: methodTotal ? (m.amount / methodTotal) * 100 : 0,
              sub: `${m.n} payment${m.n === 1 ? '' : 's'}`,
            }))} />
          ) : <EmptyState title="No captured payments yet" />}
        </Card>

        <Card className="card-pad">
          <SectionHead title="Decline reasons" subtitle="Why payments failed." />
          {data.failureReasons.length ? (
            <div className="space-y-2">
              {data.failureReasons.map((f: any) => (
                <div key={f.reason} className="flex items-start justify-between gap-3 border-b border-line pb-2 last:border-0">
                  <span className="text-[12px] leading-snug text-ink-2">{f.reason}</span>
                  <Chip tone="bad">{f.n}</Chip>
                </div>
              ))}
            </div>
          ) : <EmptyState title="No failed payments" hint="Nothing declined in this period." />}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="card-pad">
          <SectionHead title="Orders by hour" subtitle="When your demand actually lands — the same signal the Detection Agent reads." />
          <HourlyBars data={data.hourly} />
        </Card>

        <Card className="card-pad">
          <SectionHead title="Learned price response"
            subtitle="Conversion observed at each price point. This is what steers the next offer." />
          {data.learning.length ? (
            <div className="space-y-4">
              {Object.entries(groupBy(data.learning, 'product_name')).map(([name, rows]: any) => {
                const max = Math.max(...rows.map((r: any) => (r.impressions ? r.conversions / r.impressions : 0)), 0.001);
                return (
                  <div key={name}>
                    <div className="mb-2 text-[12.5px] font-medium text-ink">{name}</div>
                    <BarList items={rows.sort((a: any, b: any) => b.price_paise - a.price_paise).map((r: any) => {
                      const rate = r.impressions ? r.conversions / r.impressions : 0;
                      return {
                        label: inr(r.price_paise), value: pct(rate * 100),
                        pct: (rate / max) * 100,
                        sub: `${r.conversions}/${r.impressions} conversions · ${inr(r.revenue_paise)} revenue`,
                      };
                    })} />
                  </div>
                );
              })}
            </div>
          ) : <EmptyState title="No campaign outcomes yet" />}
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  const c = tone === 'good' ? 'text-good' : tone === 'brand' ? 'text-brand' : tone === 'sand' ? 'text-sand' : 'text-ink';
  return (
    <Card glass className="p-4">
      <div className="label">{label}</div>
      <div className={`mt-2 text-[24px] font-semibold leading-none tnum ${c}`}>{value}</div>
      {hint && <div className="mt-1.5 text-[11px] text-ink-3">{hint}</div>}
    </Card>
  );
}

function groupBy<T extends Record<string, any>>(rows: T[], key: string) {
  return rows.reduce<Record<string, T[]>>((acc, r) => { (acc[r[key]] ||= []).push(r); return acc; }, {});
}
