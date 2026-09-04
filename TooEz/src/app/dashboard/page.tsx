'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, SectionHead, StatCard, Chip, Meter, Skeleton, EmptyState, ErrorState, Segmented, ORDER_TONE, humanStatus, methodLabel } from '@/components/ui/kit';
import { RevenueChart, Donut, BarList } from '@/components/ui/charts';
import { Icon } from '@/components/ui/icons';
import { useApi, useLiveRefresh, inr, compactINR, pct, greeting, dateTime, downloadCsv } from '@/components/ui/data';

type Range = 'today' | '7d' | '30d' | '90d';
const RANGES: { value: Range; label: string }[] = [
  { value: 'today', label: 'Today' }, { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' }, { value: '90d', label: '90 days' },
];

const STATUS_COLOR: Record<string, string> = {
  PAID: 'var(--good)',
  CREATED: 'var(--brand)',
  AWAITING_CONFIRMATION: 'var(--warn)',
  FAILED: 'var(--bad)',
  REFUNDED: 'var(--sand)',
  PARTIALLY_REFUNDED: 'var(--sand)',
  ABANDONED: 'var(--text-4)',
};

export default function Overview() {
  const [range, setRange] = useState<Range>('7d');
  const { data, loading, error, reload } = useApi<any>(`/api/dashboard/overview?range=${range}`, [range]);
  useLiveRefresh(useCallback(() => reload(true), [reload]));

  const spark = useMemo(() => (data?.series ?? []).map((s: any) => s.revenuePaise), [data]);
  const orderSpark = useMemo(() => (data?.series ?? []).map((s: any) => s.orders), [data]);

  if (error) {
    return <Card className="mt-6"><ErrorState message={error} onRetry={() => reload()} /></Card>;
  }

  if (loading && !data) return <OverviewSkeleton />;

  const k = data.kpis;
  const owner = data.merchant?.owner_name;
  const firstName = owner?.split(/\s+/)[0] ?? data.merchant?.name ?? 'there';

  const statusSlices = (data.orderStatus ?? []).map((s: any) => ({
    label: humanStatus(s.status), value: s.n, tone: STATUS_COLOR[s.status] ?? 'var(--text-4)', raw: s.status,
  }));
  const statusTotal = statusSlices.reduce((a: number, s: any) => a + s.value, 0);

  return (
    <div className="fade-up space-y-4">
      {/* ---------------- header ---------------- */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[21px] font-semibold tracking-[-0.02em] text-ink">
            {greeting()}, {firstName}
          </h1>
          <p className="mt-1 text-[12.5px] text-ink-3">
            Here&apos;s how your business is doing{range === 'today' ? ' today' : ` over the last ${range.replace('d', ' days')}`}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Segmented options={RANGES} value={range} onChange={setRange} />
          <button className="btn-ghost" onClick={() => downloadCsv(`tooez-revenue-${range}.csv`, data.series)}
            disabled={!data.series?.length}>
            <Icon.Download /> Export
          </button>
        </div>
      </div>

      {data.empty && (
        <Card className="border-brand-border bg-brand-soft p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-medium text-ink">No orders in this period yet</div>
              <p className="mt-0.5 text-[12px] text-ink-2">
                Everything below is computed from your real data, so it stays at zero until an order comes through.
                Run the revenue agents to create a live offer, then place a test order.
              </p>
            </div>
            <Link className="btn-primary shrink-0" href="/dashboard/agents"><Icon.Sparkle /> Run revenue agents</Link>
          </div>
        </Card>
      )}

      {/* ---------------- Header ---------------- */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mt-2">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight text-ink">Good afternoon, Vetri <span className="inline-block origin-[70%_70%] animate-[wave_2.5s_infinite]">👋</span></h1>
          <p className="text-[14px] text-ink-3 mt-1">Here&apos;s what&apos;s happening with your business this week.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 shadow-sm text-[13px] font-medium text-ink cursor-pointer hover:bg-surface-2 transition-colors">
            <Icon.Customers size={16} className="text-ink-3" />
            <span>Sep 1, 2025 - Sep 7, 2025</span>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes wave {
          0% { transform: rotate( 0.0deg) }
          10% { transform: rotate(14.0deg) }
          20% { transform: rotate(-8.0deg) }
          30% { transform: rotate(14.0deg) }
          40% { transform: rotate(-4.0deg) }
          50% { transform: rotate(10.0deg) }
          60% { transform: rotate( 0.0deg) }
          100% { transform: rotate( 0.0deg) }
        }
      `}} />

      {/* ---------------- KPIs ---------------- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mt-6 mb-8">
        <StatCard label="Total revenue" value={compactINR(k.revenue.value)} delta={k.revenue.deltaPct}
          spark={spark} tone="brand" icon={<Icon.Payments size={20} />}
          sub={<>{inr(k.revenue.agentRevenue)} agent-driven · {inr(k.revenue.organicRevenue)} counter</>}
          deltaLabel={k.revenue.deltaPct == null ? 'no comparable prior period' : `vs last period`} />
        <StatCard label="Total orders" value={k.orders.value} delta={k.orders.deltaPct}
          spark={orderSpark} tone="good" icon={<Icon.Orders size={20} />}
          sub={<>{k.successfulPayments.value} paid · {k.failedPayments.value} failed</>}
          deltaLabel={k.orders.deltaPct == null ? 'no comparable prior period' : `vs last period`} />
        <StatCard label="Successful payments" value={k.successfulPayments.value} delta={k.successfulPayments.deltaPct}
          tone="good" icon={<Icon.Products size={20} />} sub={<>{pct(k.successfulPayments.rate)} success rate</>}
          deltaLabel={`${k.successRateDeltaPts >= 0 ? '+' : ''}${k.successRateDeltaPts.toFixed(1)} pts vs last period`} />
        <StatCard label="Failed payments" value={k.failedPayments.value} delta={k.failedPayments.deltaPct} invertDelta
          tone={k.failedPayments.value ? 'bad' : 'neutral'} icon={<Icon.Alert size={20} />} sub={<>{pct(k.failedPayments.rate)} of all attempts</>}
          deltaLabel={k.failedPayments.value ? 'see Payments for decline reasons' : 'no declines in this period'} />
      </div>

      {/* ---------------- charts + quick actions ---------------- */}
      <div className="grid gap-4 xl:grid-cols-4 mb-4">
        <Card className="card-pad xl:col-span-2 flex flex-col">
          <SectionHead title="Revenue Overview" subtitle="Daily revenue from successful payments."
            right={<span className="text-[12px] font-bold px-2.5 py-1 rounded-md bg-surface-2 border border-line">Last 7 days</span>} />
          {data.series?.length ? <RevenueChart data={data.series} /> : <EmptyState title="No revenue data yet" />}
        </Card>

        <Card className="card-pad flex flex-col">
          <SectionHead title="Order Status" subtitle="Distribution of all orders" />
          {statusTotal === 0 ? (
            <EmptyState title="No orders yet" hint="Order states appear here as soon as customers start checking out." />
          ) : (
            <div className="flex flex-col items-center gap-4 flex-1 justify-center">
              <Donut slices={statusSlices} total={statusTotal} />
              <div className="w-full space-y-2 mt-2">
                {statusSlices.map((s: any) => (
                  <div key={s.label} className="flex items-center gap-2.5 text-[11px]">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.tone }} />
                    <span className="flex-1 truncate text-ink-3">{s.label}</span>
                    <span className="tnum text-ink">{s.value}</span>
                    <span className="w-10 text-right tnum text-ink-4">({pct((s.value / statusTotal) * 100, 1)})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card className="card-pad flex flex-col">
          <SectionHead title="Quick Actions" />
          <div className="flex flex-col gap-2 mt-1 flex-1">
            <QuickAction href="/dashboard/agents" icon={<Icon.Orders />} label="Create Order" hint="Manually create a new order" />
            <QuickAction href="/dashboard/payments" icon={<Icon.Refund />} label="Issue Refund" hint="Process a customer refund" />
            <QuickAction href="/dashboard/payments" icon={<Icon.Payments />} label="View All Payments" hint="See all payment transactions" />
            <QuickAction href="/dashboard/analytics" icon={<Icon.Analytics />} label="Generate Report" hint="Get detailed business insights" />
          </div>
        </Card>
      </div>

      {/* ---------------- recent + top products ---------------- */}
      <div className="grid items-start gap-4 xl:grid-cols-4 pb-12">
        <Card className="xl:col-span-3">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <SectionHead title="Recent Transactions" />
            <Link href="/dashboard/orders" className="text-[11.5px] font-semibold text-ink-3 flex items-center gap-1 hover:text-ink transition-colors">View all <Icon.Chevron size={14} /></Link>
          </div>
          {data.recent?.length ? (
            <div className="overflow-x-auto px-2 pb-3">
              <table className="w-full">
                <thead><tr className="border-b border-line-strong/50">
                  <th className="th !text-[11.5px] !font-medium !text-ink-4 !capitalize">Order ID</th>
                  <th className="th !text-[11.5px] !font-medium !text-ink-4 !capitalize">Customer</th>
                  <th className="th !text-[11.5px] !font-medium !text-ink-4 !capitalize">Amount</th>
                  <th className="th !text-[11.5px] !font-medium !text-ink-4 !capitalize">Status</th>
                  <th className="th !text-[11.5px] !font-medium !text-ink-4 !capitalize">Payment Method</th>
                  <th className="th !text-[11.5px] !font-medium !text-ink-4 !capitalize">Date</th>
                </tr></thead>
                <tbody>
                  {data.recent.map((o: any) => (
                    <tr key={o.id} className="tr-hover border-b border-line-strong/30 last:border-0 transition-colors">
                      <td className="td font-mono font-medium text-[11.5px] text-ink">{o.id}</td>
                      <td className="td text-[12px] font-medium text-ink-2">{o.customer_name || <span className="text-ink-4 font-normal">Guest</span>}</td>
                      <td className="td text-[12px] font-bold text-ink">{inr(o.amount_paise)}</td>
                      <td className="td">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-semibold tracking-wide ${o.status === 'PAID' ? 'bg-good-soft text-good' : o.status === 'FAILED' ? 'bg-bad-soft text-bad' : 'bg-surface-2 text-ink-3'}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                          {o.status === 'PAID' ? 'Successful' : humanStatus(o.status)}
                        </span>
                      </td>
                      <td className="td text-[12px] text-ink-2">{methodLabel(o.payment_method)}</td>
                      <td className="td text-[12px] text-ink-3">{dateTime(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No transactions yet"
              hint="Approve an agent campaign, then open its customer link to place the first order."
              action={<Link className="btn-primary" href="/dashboard/agents">Go to revenue agents</Link>} />
          )}
        </Card>

        <div className="space-y-4 xl:col-span-1">
          <Card className="card-pad flex flex-col min-h-full">
            <div className="flex items-center justify-between mb-2">
              <SectionHead title="Top Selling Items" />
              <span className="text-[11px] px-2 py-1 rounded-md bg-surface-2 text-ink-3 border border-line">Last 7 days</span>
            </div>
            {data.topProducts?.length ? (
              <div className="flex flex-col gap-4 mt-2">
                {data.topProducts.map((p: any) => (
                  <div key={p.id} className="w-full">
                    <div className="flex justify-between items-center mb-1.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-surface-2 overflow-hidden flex items-center justify-center shrink-0 border border-line text-[14px]">🍲</div>
                        <div>
                          <div className="text-[12px] font-bold text-ink">{p.name}</div>
                          <div className="text-[10px] text-ink-4">{p.total_units} orders</div>
                        </div>
                      </div>
                      <div className="text-[11px] font-semibold text-ink-3">{pct(p.share_pct, 0)}</div>
                    </div>
                    <Meter value={p.share_pct} max={100} tone="brand" className="!h-1 !bg-brand-soft" />
                  </div>
                ))}
              </div>
            ) : <EmptyState title="No sales recorded" />}
          </Card>
        </div>
      </div>
    </div>
  );
}

function QuickAction({ href, icon, label, hint }: { href: string; icon: React.ReactNode; label: string; hint: string }) {
  return (
    <Link href={href}
      className="group rounded-lg border border-line bg-surface-2 px-3 py-2.5 transition-colors hover:border-brand-border hover:bg-brand-soft">
      <span className="flex items-center gap-2 text-[12.5px] font-medium text-ink">
        <span className="text-ink-3 transition-colors group-hover:text-brand">{icon}</span>{label}
      </span>
      <span className="mt-0.5 block text-[10.5px] text-ink-4">{hint}</span>
    </Link>
  );
}

function AgentImpact({ impact, guardrails }: { impact: any; guardrails: any }) {
  if (!impact) return null;
  const used = guardrails.discountSpentPaise / Math.max(guardrails.discountBudgetPaise, 1);
  return (
    <Card className="card-pad">
      <SectionHead title="Agent activity" subtitle="What the revenue agents have done for you." />
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        <Fact label="Opportunities found" value={impact.opportunities_detected} />
        <Fact label="Campaigns created" value={impact.campaigns} />
        <Fact label="Offers approved" value={impact.offers_approved} tone="good" />
        <Fact label="Offers vetoed" value={impact.offers_vetoed} tone="bad" />
      </div>
      <div className="mt-4 border-t border-line pt-3">
        <div className="mb-1.5 flex justify-between text-[11.5px]">
          <span className="text-ink-3">Discount budget used today</span>
          <span className="tnum text-ink">{inr(guardrails.discountSpentPaise)} / {inr(guardrails.discountBudgetPaise)}</span>
        </div>
        <Meter value={guardrails.discountSpentPaise} max={guardrails.discountBudgetPaise} tone={used > 0.85 ? 'bad' : 'warn'} />
      </div>
    </Card>
  );
}

function Fact({ label, value, tone }: { label: string; value: number; tone?: 'good' | 'bad' }) {
  const c = tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : 'text-ink';
  return (
    <div>
      <div className={`text-[18px] font-semibold leading-none tnum ${c}`}>{value}</div>
      <div className="mt-1 text-[10.5px] text-ink-3">{label}</div>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <div className="flex justify-between"><Skeleton className="h-12 w-64" /><Skeleton className="h-9 w-56" /></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[122px]" />)}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-[320px] xl:col-span-2" /><Skeleton className="h-[320px]" />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-[280px] xl:col-span-2" /><Skeleton className="h-[280px]" />
      </div>
    </div>
  );
}
