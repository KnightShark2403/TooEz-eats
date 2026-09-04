'use client';

import { useCallback, useState } from 'react';
import { Card, SectionHead, Chip, Skeleton, ErrorState, Meter, Segmented } from '@/components/ui/kit';
import { Icon } from '@/components/ui/icons';
import { useTheme } from '@/components/theme';
import { useApi, useLiveRefresh, inr } from '@/components/ui/data';

const TABS = [
  { value: 'guardrails', label: 'Payments & guardrails' },
  { value: 'appearance', label: 'Appearance' },
  { value: 'integrations', label: 'Integrations' },
] as const;
type Tab = typeof TABS[number]['value'];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('guardrails');
  const { data, loading, error, reload } = useApi<any>('/api/state');
  const health = useApi<any>('/api/health');
  useLiveRefresh(useCallback(() => reload(true), [reload]));

  if (error) return <Card><ErrorState message={error} onRetry={() => reload()} /></Card>;
  if (loading && !data) return <div className="space-y-3"><Skeleton className="h-14" /><Skeleton className="h-96" /></div>;

  return (
    <div className="fade-up space-y-4">
      <div>
        <h1 className="text-[21px] font-semibold tracking-[-0.02em] text-ink">Settings</h1>
        <p className="mt-1 text-[12.5px] text-ink-3">Business rules, appearance, and payment integration status.</p>
      </div>

      <Segmented options={TABS as any} value={tab} onChange={(v: any) => setTab(v)} />

      {tab === 'guardrails' && <Guardrails policies={data.policies} kpis={data.kpis} onChanged={() => reload(true)} />}
      {tab === 'appearance' && <Appearance />}
      {tab === 'integrations' && <Integrations gateway={data.gateway} health={health.data} onReset={() => reload(true)} />}
    </div>
  );
}

/* ------------------------------------------------------------- guardrails */

function Guardrails({ policies, kpis, onChanged }: { policies: any; kpis: any; onChanged: () => void }) {
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const v = (k: string) => (draft[k] !== undefined ? draft[k] : policies[k]);
  const dirty = Object.keys(draft).length > 0;

  const save = async () => {
    setSaving(true);
    try {
      await fetch('/api/policies', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(draft) });
      setDraft({}); onChanged();
    } finally { setSaving(false); }
  };

  return (
    <Card className="card-pad">
      <SectionHead title="Merchant guardrails" subtitle="The only inputs to the Risk Agent's verdict."
        right={<Chip tone="bad"><Icon.Shield size={12} /> enforced server-side</Chip>} />
      <p className="mb-4 text-[11.5px] leading-relaxed text-ink-3">
        The Offer Agent cannot read this table — that separation is what makes the veto a control rather than a
        suggestion. Change a number and re-run the agents to watch the decision change.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Minimum gross margin" suffix="%" value={v('min_margin_pct')} step={0.5}
          onChange={(n) => setDraft({ ...draft, min_margin_pct: n })}
          hint="An offer must retain at least this margin over unit cost." />
        <Field label="Maximum discount depth" suffix="%" value={v('max_discount_pct')} step={1}
          onChange={(n) => setDraft({ ...draft, max_discount_pct: n })}
          hint="How far below list price an offer may go." />
        <Field label="Daily discount budget" suffix="₹" value={v('daily_discount_budget_paise') / 100} step={100}
          onChange={(n) => setDraft({ ...draft, daily_discount_budget_paise: Math.round(n * 100) })}
          hint="Total subsidy the agents may commit across all campaigns today." />
        <Field label="Max single-campaign exposure" suffix="₹" value={v('max_campaign_exposure_paise') / 100} step={100}
          onChange={(n) => setDraft({ ...draft, max_campaign_exposure_paise: Math.round(n * 100) })}
          hint="Subsidy at risk on any one campaign." />
        <Field label="Max concurrent campaigns" value={v('max_active_campaigns')} step={1}
          onChange={(n) => setDraft({ ...draft, max_active_campaigns: Math.round(n) })}
          hint="Prevents training customers to always wait for a discount." />
        <Field label="Cannibalization window" suffix="min" value={v('cannibalization_window_min')} step={5}
          onChange={(n) => setDraft({ ...draft, cannibalization_window_min: Math.round(n) })}
          hint="Don't discount a item that just sold at list price inside this window." />
      </div>

      <label className="mt-4 flex cursor-pointer items-center gap-2.5 rounded-lg border border-line bg-surface-2 px-3.5 py-2.5">
        <input type="checkbox" checked={v('require_merchant_approval') === 1}
          onChange={(e) => setDraft({ ...draft, require_merchant_approval: e.target.checked ? 1 : 0 })}
          className="h-3.5 w-3.5 accent-[color:var(--brand)]" />
        <span className="text-[12px] text-ink">Require my approval before a campaign goes live</span>
        <span className="ml-auto text-[10.5px] text-ink-4">human-in-the-loop</span>
      </label>

      <div className="mt-4 rounded-lg border border-line bg-surface-2 p-3.5">
        <div className="mb-1.5 flex justify-between text-[11.5px]">
          <span className="text-ink-3">Discount budget used today</span>
          <span className="tnum text-ink">{inr(kpis.discountSpentPaise)} of {inr(kpis.discountBudgetPaise)}</span>
        </div>
        <Meter value={kpis.discountSpentPaise} max={kpis.discountBudgetPaise}
          tone={kpis.discountSpentPaise / kpis.discountBudgetPaise > 0.85 ? 'bad' : 'warn'} />
      </div>

      {dirty && (
        <div className="mt-4 flex items-center justify-end gap-2">
          <button className="btn-ghost" onClick={() => setDraft({})}>Discard</button>
          <button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save guardrails'}</button>
        </div>
      )}
    </Card>
  );
}

function Field({ label, value, onChange, suffix, step = 1, hint }: {
  label: string; value: number; onChange: (n: number) => void; suffix?: string; step?: number; hint?: string;
}) {
  const id = label.replace(/\s+/g, '-').toLowerCase();
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-[12px] font-medium text-ink">{label}</label>
        {suffix && <span className="text-[10.5px] text-ink-4">{suffix}</span>}
      </div>
      <input id={id} type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="field mt-1.5 tnum" />
      {hint && <p className="mt-1 text-[10.5px] leading-relaxed text-ink-4">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------- appearance */

function Appearance() {
  const { theme, setTheme } = useTheme();
  return (
    <Card className="card-pad">
      <SectionHead title="Appearance" subtitle="Both themes share the same data, routes and components." />
      <div className="grid gap-3 sm:grid-cols-2">
        {(['light', 'dark'] as const).map((t) => (
          <button key={t} onClick={() => setTheme(t)}
            className={`rounded-xl border p-3 text-left transition-all ${
              theme === t ? 'border-brand ring-1 ring-brand-border' : 'border-line hover:border-line-strong'}`}>
            <div className="mb-3 h-24 overflow-hidden rounded-lg border border-line"
              style={{ background: t === 'light' ? '#f7f6f3' : '#0a0e1a' }}>
              <div className="flex h-full">
                <div className="h-full w-1/4" style={{ background: t === 'light' ? '#ffffff' : '#121a2c' }} />
                <div className="flex-1 p-2">
                  <div className="mb-1.5 h-2 w-2/3 rounded" style={{ background: t === 'light' ? '#4338ca' : '#8b8cf7' }} />
                  <div className="mb-1 h-1.5 w-full rounded" style={{ background: t === 'light' ? '#e4e2db' : '#223050' }} />
                  <div className="mb-1 h-1.5 w-4/5 rounded" style={{ background: t === 'light' ? '#e4e2db' : '#223050' }} />
                  <div className="h-1.5 w-1/2 rounded" style={{ background: t === 'light' ? '#b99a6b' : '#d8bd91' }} />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-ink">{t === 'light' ? 'Indigo & beige' : 'Midnight'}</span>
              {theme === t && <span className="text-brand"><Icon.Check /></span>}
            </div>
            <p className="mt-0.5 text-[11px] text-ink-3">
              {t === 'light' ? 'Warm, high-contrast daylight mode.' : 'Low-glare mode for evening service.'}
            </p>
          </button>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-ink-4">Your choice is remembered on this device.</p>
    </Card>
  );
}

/* ----------------------------------------------------------- integrations */

function Integrations({ gateway, health, onReset }: { gateway: any; health: any; onReset: () => void }) {
  const [resetting, setResetting] = useState(false);
  const rz = health?.razorpay;

  const reset = async () => {
    if (!confirm('Rebuild the demo dataset? This clears all campaigns, orders, payments and audit history.')) return;
    setResetting(true);
    try { await fetch('/api/dev/reset', { method: 'POST' }); onReset(); } finally { setResetting(false); }
  };

  return (
    <div className="space-y-4">
      <Card className="card-pad">
        <SectionHead title="Razorpay" subtitle="Payments are executed server-side. No secret ever reaches this browser."
          right={<Chip tone={gateway.mode === 'razorpay' ? (gateway.testMode ? 'warn' : 'good') : 'neutral'} dot>
            {gateway.mode === 'razorpay' ? (gateway.testMode ? 'TEST MODE' : 'LIVE') : 'MOCK GATEWAY'}
          </Chip>} />

        {gateway.problems?.length > 0 && (
          <div className="mb-3 rounded-lg border border-bad-border bg-bad-soft px-3.5 py-2.5 text-[12px] text-bad">
            {gateway.problems.map((p: string, i: number) => <div key={i}>{p}</div>)}
          </div>
        )}
        {gateway.warnings?.length > 0 && (
          <div className="mb-3 rounded-lg border border-warn-border bg-warn-soft px-3.5 py-2.5 text-[12px] text-warn">
            {gateway.warnings.map((p: string, i: number) => <div key={i}>{p}</div>)}
          </div>
        )}

        <div className="divide-y divide-[color:var(--border)] rounded-lg border border-line">
          <Row k="Key ID" v={gateway.keyId ?? 'not configured'} mono
            note="Public identifier. Safe in the browser — Razorpay Checkout requires it." ok={Boolean(gateway.keyId)} />
          <Row k="Key Secret" v={rz?.keySecretConfigured ? 'configured (server-side only)' : 'not configured'}
            note="Never sent to the browser, never logged." ok={Boolean(rz?.keySecretConfigured)} />
          <Row k="Webhook Secret" v={rz?.webhookSecretConfigured ? 'configured (server-side only)' : 'not configured'}
            note="A different secret from the key secret. Verifies inbound webhook signatures." ok={Boolean(rz?.webhookSecretConfigured)} />
          <Row k="Webhook endpoint" v="POST /api/webhooks/razorpay" mono
            note="Point your Razorpay webhook here. Needs a public HTTPS URL — use ngrok in development." ok />
          <Row k="Database" v={health?.database?.ok ? 'reachable' : 'unavailable'} ok={Boolean(health?.database?.ok)} />
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-ink-4">
          Credentials live in <code className="rounded bg-surface-sunk px-1 py-0.5 font-mono">.env.local</code>, which is
          gitignored. The dashboard reads payment data from the TooEz backend and never calls Razorpay directly.
        </p>
      </Card>

      <Card className="card-pad">
        <SectionHead title="AI narration" subtitle="Optional. Phrases agent reasoning; never computes a number." />
        <Chip tone={gateway.llm ? 'good' : 'neutral'}>{gateway.llm ? 'LLM narration enabled' : 'Deterministic narration'}</Chip>
        <p className="mt-2 text-[11.5px] leading-relaxed text-ink-3">
          Set <code className="rounded bg-surface-sunk px-1 py-0.5 font-mono">ANTHROPIC_API_KEY</code> or{' '}
          <code className="rounded bg-surface-sunk px-1 py-0.5 font-mono">OPENAI_API_KEY</code> to have offer reasoning
          written in prose. Prices, margins, forecasts and risk verdicts stay deterministic either way.
        </p>
      </Card>

      <Card className="card-pad">
        <SectionHead title="Demo data" subtitle="Rebuilds the seeded merchant, demand history and prior campaigns." />
        <button className="btn-bad" onClick={reset} disabled={resetting}>
          <Icon.Refresh /> {resetting ? 'Resetting…' : 'Reset demo dataset'}
        </button>
        <p className="mt-2 text-[11px] text-ink-4">
          Demand history is re-anchored to the current hour, so the “demand is falling” signal reads correctly whenever you demo.
        </p>
      </Card>
    </div>
  );
}

function Row({ k, v, note, mono, ok }: { k: string; v: string; note?: string; mono?: boolean; ok?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 px-3.5 py-2.5">
      <div className="min-w-0">
        <div className="text-[12px] font-medium text-ink">{k}</div>
        {note && <div className="mt-0.5 text-[10.5px] leading-relaxed text-ink-4">{note}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={`text-[11.5px] ${mono ? 'font-mono' : ''} ${ok ? 'text-ink-2' : 'text-ink-4'}`}>{v}</span>
        <span className={ok ? 'text-good' : 'text-ink-4'}>{ok ? <Icon.Check size={14} /> : <Icon.Close size={14} />}</span>
      </div>
    </div>
  );
}
