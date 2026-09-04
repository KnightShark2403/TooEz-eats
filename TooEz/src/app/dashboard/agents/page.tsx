'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, SectionHead, Chip, Skeleton, EmptyState, ErrorState } from '@/components/ui/kit';
import { Icon } from '@/components/ui/icons';
import { OpportunityCard } from '@/components/agents/OpportunityCard';
import { DecisionConsole } from '@/components/agents/DecisionConsole';
import { AuditLog } from '@/components/agents/AuditLog';
import { useApi, useLiveRefresh, inr } from '@/components/ui/data';

/**
 * AI Assistant — TooEz's revenue agents.
 * This is the real AI surface of the product: nothing here is a placeholder.
 */
export default function AgentsPage() {
  const { data, loading, error, reload } = useApi<any>('/api/state');
  useLiveRefresh(useCallback(() => reload(true), [reload]));

  const [selected, setSelected] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const opps: any[] = data?.opportunities ?? [];

  useEffect(() => {
    if (!data) return;
    if (selected && !opps.some((o) => o.id === selected)) {
      const hasCampaign = data.campaigns?.some((c: any) => c.opportunity_id === selected);
      if (!hasCampaign) setSelected(opps[0]?.id ?? null);
    } else if (!selected && opps.length) setSelected(opps[0].id);
  }, [data, opps, selected]);

  const scan = async () => {
    setScanning(true); setNotice(null);
    try {
      const r = await fetch('/api/scan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? 'The scan could not be completed.');
      if (j.opportunities?.length) setSelected(j.opportunities[0].id);
      else setNotice(`No new opportunities. ${(j.skipped ?? []).map((s: any) => `${s.product}: ${s.reason}`).join(' · ')}`);
      await reload(true);
    } catch (e: any) { setNotice(e.message ?? 'The scan could not be completed.'); } finally { setScanning(false); }
  };

  const runAgents = async (opportunityId: string) => {
    setRunning(opportunityId); setNotice(null); setSelected(opportunityId);
    try {
      const r = await fetch('/api/pipeline/run', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ opportunityId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? 'The agent run failed.');
      if (j.outcome === 'ABANDONED') setNotice(`Risk Agent blocked this opportunity entirely — ${j.abandonReason}`);
      await reload(true);
    } catch (e: any) { setNotice(e.message ?? 'The agent run failed.'); } finally { setRunning(null); }
  };

  if (error) return <Card><ErrorState message={error} onRetry={() => reload()} /></Card>;
  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16" />
        <div className="grid items-start gap-4 xl:grid-cols-5"><Skeleton className="h-96 xl:col-span-2" /><Skeleton className="h-96 xl:col-span-3" /></div>
      </div>
    );
  }

  return (
    <div className="fade-up space-y-4">
      <Card glass className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="text-sand"><Icon.Sparkle size={18} /></span>
              <h1 className="text-[19px] font-semibold tracking-[-0.02em] text-ink">Let AI help you grow</h1>
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">
              Four agents watch your inventory and demand. Detection finds revenue about to be lost, the Offer Agent
              prices it, an <b>independent Risk Agent</b> checks it against your guardrails and can veto it, and the
              Settlement Agent executes it through Razorpay. Nothing goes live without your approval.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Chip tone="brand">Detect</Chip><Chip tone="sand">Decide</Chip><Chip tone="bad">Risk-check</Chip>
              <Chip tone="warn">Approve</Chip><Chip tone="good">Transact</Chip><Chip tone="neutral">Learn</Chip>
            </div>
          </div>
          <button className="btn-primary" onClick={scan} disabled={scanning}>
            <Icon.Refresh /> {scanning ? 'Scanning…' : 'Scan for opportunities'}
          </button>
        </div>
      </Card>

      {notice && (
        <div className="rounded-lg border border-warn-border bg-warn-soft px-4 py-2.5 text-[12px] text-warn">{notice}</div>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-5">
        <div className="space-y-3 xl:col-span-2">
          <SectionHead title="Revenue opportunities" right={<Chip tone="neutral">{opps.length} open</Chip>} />
          {opps.length === 0 ? (
            <Card><EmptyState title="No open opportunities" icon={<Icon.Agent size={26} />}
              hint="The Detection Agent found nothing above the ₹150 materiality threshold. Scan again after a demand shift, or reset the demo dataset from Settings."
              action={<button className="btn-primary" onClick={scan}>Scan now</button>} /></Card>
          ) : opps.map((o) => (
            <OpportunityCard key={o.id} opp={o} selected={selected === o.id}
              onSelect={() => setSelected(o.id)} onRun={() => runAgents(o.id)} running={running === o.id} />
          ))}

          {data.campaigns?.length > 0 && (
            <>
              <SectionHead title="Recent campaigns" />
              <div className="space-y-2">
                {data.campaigns.slice(0, 6).map((c: any) => (
                  <button key={c.id} onClick={() => setSelected(c.opportunity_id)}
                    className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-line-strong">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Chip tone={c.status === 'LIVE' ? 'good' : c.status === 'PENDING_APPROVAL' ? 'warn' : c.status === 'REJECTED' ? 'bad' : 'neutral'}>
                            {c.status.replace(/_/g, ' ')}
                          </Chip>
                          <span className="text-[12.5px] font-medium tnum text-ink">{inr(c.price_paise)}</span>
                        </div>
                        <div className="mt-1 truncate text-[11.5px] text-ink-3">{c.product_name}</div>
                      </div>
                      <div className="shrink-0 text-right text-[11px] tnum text-ink-3">
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

        <div className="xl:col-span-3">
          <SectionHead title="Agent decision timeline"
            right={<Chip tone="neutral">Detect → Decide → Risk-check → Approve → Transact → Learn</Chip>} />
          <DecisionConsole opportunityId={selected} onChanged={() => reload(true)} version={data.audit?.[0]?.id} />
        </div>
      </div>

      <AuditLog rows={data.audit ?? []} />
    </div>
  );
}
