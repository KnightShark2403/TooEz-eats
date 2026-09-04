'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLiveState } from '@/components/useLiveState';
import { Stat, Chip, SectionTitle, Empty, Skeleton } from '@/components/primitives';
import { OpportunityCard } from '@/components/OpportunityCard';
import { DecisionConsole } from '@/components/DecisionConsole';
import { AuditLog } from '@/components/AuditLog';
import { Guardrails } from '@/components/Guardrails';
import { LearningPanel } from '@/components/LearningPanel';
import { OrdersPanel } from '@/components/OrdersPanel';
import { inr, pct } from '@/components/format';

type Tab = 'operations' | 'guardrails' | 'learning' | 'payments';

export default function Dashboard() {
  const { data, loading, error, refresh } = useLiveState();
  const [tab, setTab] = useState<Tab>('operations');
  const [selected, setSelected] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const opps: any[] = data?.opportunities ?? [];

  // Keep a sensible selection as opportunities open and close.
  useEffect(() => {
    if (!data) return;
    if (selected && !opps.some((o) => o.id === selected)) {
      const stillHasTimeline = data.campaigns?.some((c: any) => c.opportunity_id === selected);
      if (!stillHasTimeline) setSelected(opps[0]?.id ?? null);
    } else if (!selected && opps.length) {
      setSelected(opps[0].id);
    }
  }, [data, opps, selected]);

  const scan = async () => {
    setScanning(true); setNotice(null);
    try {
      const r = await fetch('/api/scan', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}),
      });
      const j = await r.json();
      if (j.opportunities?.length) setSelected(j.opportunities[0].id);
      else setNotice(
        `No new opportunities. ${(j.skipped ?? []).map((s: any) => `${s.product}: ${s.reason}`).join(' · ')}`
      );
      await refresh();
    } finally { setScanning(false); }
  };

  const runAgents = async (opportunityId: string) => {
    setRunning(opportunityId); setNotice(null); setSelected(opportunityId);
    try {
      const r = await fetch('/api/pipeline/run', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ opportunityId }),
      });
      const j = await r.json();
      if (j.outcome === 'ABANDONED') setNotice(`Risk Agent blocked this opportunity entirely — ${j.abandonReason}`);
      await refresh();
    } finally { setRunning(null); }
  };

  const resetDemo = async () => {
    if (!confirm('Rebuild the demo dataset? This clears all campaigns, orders and audit history.')) return;
    await fetch('/api/dev/reset', { method: 'POST' });
    setSelected(null); setNotice(null); await refresh();
  };

  if (loading && !data) {
    return (
      <main className="mx-auto max-w-[1500px] px-6 py-8">
        <Skeleton className="mb-6 h-14" />
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-5">
          <Skeleton className="h-[420px] lg:col-span-2" /><Skeleton className="h-[420px] lg:col-span-3" />
        </div>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24">
        <Empty title="Could not reach the TooEz backend" hint={error}
          action={<button className="btn-primary mt-3" onClick={refresh}>Retry</button>} />
      </main>
    );
  }

  const k = data.kpis;
  const g = data.gateway;

  return (
    <main className="mx-auto max-w-[1500px] px-5 py-6 lg:px-8">
      {/* ---------- Header ---------- */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-[15px] font-bold text-white">T</div>
          <div>
            <h1 className="text-[17px] font-semibold leading-tight tracking-tight text-ink-100">TooEz</h1>
            <p className="text-[11.5px] text-ink-400">
              AI Revenue Agents for Agentic Commerce · {data.merchant.name}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={g.mode === 'razorpay' ? (g.testMode ? 'accent' : 'good') : 'warn'}>
            {g.mode === 'razorpay'
              ? `Razorpay ${g.testMode ? 'TEST' : 'LIVE'} · ${g.keyId?.slice(0, 16)}…`
              : 'MOCK GATEWAY — no Razorpay keys'}
          </Chip>
          <Chip tone={g.webhookConfigured ? 'good' : 'neutral'}>
            webhook {g.webhookConfigured ? 'armed' : 'not configured'}
          </Chip>
          <Chip tone="neutral">{g.llm ? 'LLM narration on' : 'deterministic narration'}</Chip>
          <button className="btn-ghost" onClick={resetDemo}>Reset demo</button>
          <button className="btn-primary" onClick={scan} disabled={scanning}>
            {scanning ? 'Scanning…' : 'Scan for opportunities'}
          </button>
        </div>
      </header>

      {/* ---------- KPIs ---------- */}
      <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Revenue today" value={inr(k.todayRevenuePaise)}
          sub={<>{inr(k.organicRevenuePaise)} organic · <span className="text-good">{inr(k.agentRevenuePaise)} agent-driven</span></>} />
        <Stat label="Projected recoverable" value={inr(k.projectedRecoverablePaise)} accent="accent"
          sub={`across ${k.openOpportunities} open ${k.openOpportunities === 1 ? 'opportunity' : 'opportunities'}`} />
        <Stat label="Agent-generated revenue" value={inr(k.agentRevenuePaise)} accent="good"
          sub="booked only on webhook-confirmed capture" />
        <Stat label="Active campaigns" value={k.activeCampaigns}
          sub={`policy cap ${data.policies.max_active_campaigns}`} />
        <Stat label="Discount budget used"
          value={pct((k.discountSpentPaise / Math.max(k.discountBudgetPaise, 1)) * 100, 0)}
          accent={k.discountSpentPaise / k.discountBudgetPaise > 0.85 ? 'warn' : 'default'}
          sub={`${inr(k.discountSpentPaise)} of ${inr(k.discountBudgetPaise)} today`} />
      </section>

      {/* ---------- Tabs ---------- */}
      <nav className="mb-4 flex gap-1 border-b border-ink-800">
        {([
          ['operations', 'Operations'],
          ['payments', `Payments${data.orders.length ? ` (${data.orders.length})` : ''}`],
          ['guardrails', 'Guardrails'],
          ['learning', 'Learning'],
        ] as [Tab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-3.5 py-2 text-[12.5px] font-medium transition-colors ${
              tab === id ? 'border-accent text-ink-100' : 'border-transparent text-ink-400 hover:text-ink-200'}`}>
            {label}
          </button>
        ))}
      </nav>

      {notice && (
        <div className="mb-4 rounded-lg border border-warn/35 bg-warn/[0.07] px-4 py-2.5 text-[12px] text-warn">
          {notice}
        </div>
      )}

      {tab === 'operations' && (
        <>
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="space-y-3 lg:col-span-2">
              <SectionTitle right={<Chip tone="neutral">{opps.length} open</Chip>}>Revenue opportunities</SectionTitle>
              {opps.length === 0 ? (
                <Empty title="No open opportunities"
                  hint="The Detection Agent found nothing above the ₹150 materiality threshold. Run a scan, or reset the demo dataset."
                  action={<button className="btn-primary mt-3" onClick={scan}>Scan now</button>} />
              ) : (
                opps.map((o) => (
                  <OpportunityCard key={o.id} opp={o} selected={selected === o.id}
                    onSelect={() => setSelected(o.id)} onRun={() => runAgents(o.id)}
                    running={running === o.id} />
                ))
              )}

              {data.campaigns.length > 0 && (
                <>
                  <SectionTitle>Campaigns</SectionTitle>
                  <div className="space-y-2">
                    {data.campaigns.map((c: any) => (
                      <button key={c.id} onClick={() => setSelected(c.opportunity_id)}
                        className="card w-full px-4 py-3 text-left transition-colors hover:border-ink-600">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Chip tone={
                                c.status === 'LIVE' ? 'good' :
                                c.status === 'PENDING_APPROVAL' ? 'warn' :
                                c.status === 'REJECTED' ? 'bad' : 'neutral'
                              }>{c.status.replace(/_/g, ' ')}</Chip>
                              <span className="text-[12.5px] font-medium tnum text-ink-100">{inr(c.price_paise)}</span>
                            </div>
                            <div className="mt-1 truncate text-[11.5px] text-ink-400">{c.product_name}</div>
                          </div>
                          <div className="shrink-0 text-right text-[11px] tnum text-ink-300">
                            <div>{c.units_sold}/{c.units_offered} sold</div>
                            <div className="text-good">{inr(c.revenue_paise)}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="lg:col-span-3">
              <SectionTitle right={<Chip tone="neutral">Detect → Decide → Risk-check → Approve → Transact → Learn</Chip>}>
                Agent decision timeline
              </SectionTitle>
              <DecisionConsole opportunityId={selected} onChanged={refresh} version={data.audit[0]?.id} />
            </div>
          </div>

          <div className="mt-5">
            <AuditLog rows={data.audit} />
          </div>
        </>
      )}

      {tab === 'payments' && (
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3"><OrdersPanel orders={data.orders} onChanged={refresh} gateway={g} /></div>
          <div className="lg:col-span-2"><AuditLog rows={data.audit.filter((a: any) =>
            ['SETTLEMENT_AGENT', 'RAZORPAY', 'CUSTOMER'].includes(a.actor))} compact /></div>
        </div>
      )}

      {tab === 'guardrails' && (
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3"><Guardrails policies={data.policies} kpis={k} onChanged={refresh} /></div>
          <div className="lg:col-span-2"><AuditLog rows={data.audit.filter((a: any) =>
            ['RISK_AGENT', 'MERCHANT'].includes(a.actor))} compact /></div>
        </div>
      )}

      {tab === 'learning' && (
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3"><LearningPanel learning={data.learning} /></div>
          <div className="lg:col-span-2">
            <div className="card card-pad">
              <SectionTitle>Inventory</SectionTitle>
              <div className="space-y-2">
                {data.products.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-ink-700/60 bg-ink-900/40 px-3 py-2">
                    <div>
                      <div className="text-[12.5px] font-medium text-ink-100">{p.name}</div>
                      <div className="text-[10.5px] text-ink-500">
                        list {inr(p.list_price_paise)} · unit cost {inr(p.cogs_paise)} ·
                        {' '}{pct(((p.list_price_paise - p.cogs_paise) / p.list_price_paise) * 100, 0)} margin at list
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[15px] font-semibold tnum text-ink-100">{p.stock_units}</div>
                      <div className="text-[10px] text-ink-500">units</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-8 border-t border-ink-800 pt-4 text-[10.5px] leading-relaxed text-ink-500">
        TooEz never lets a model take a financial action directly. The Offer Agent optimises revenue and cannot read
        merchant policy; the Risk Agent enforces policy and can veto; a campaign exists only after an approved verdict
        and merchant sign-off; and revenue is booked only when Razorpay confirms capture.
      </footer>
    </main>
  );
}
