'use client';
import { useState } from 'react';
import { Chip, SectionTitle, Meter } from './primitives';
import { inr, pct } from './format';

export function Guardrails({ policies, kpis, onChanged }: { policies: any; kpis: any; onChanged: () => void }) {
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const v = (k: string) => (draft[k] !== undefined ? draft[k] : policies[k]);
  const dirty = Object.keys(draft).length > 0;

  const save = async () => {
    setSaving(true);
    try {
      await fetch('/api/policies', {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(draft),
      });
      setDraft({}); onChanged();
    } finally { setSaving(false); }
  };

  return (
    <div className="card card-pad">
      <SectionTitle right={<Chip tone="neutral">enforced by the Risk Agent</Chip>}>Merchant guardrails</SectionTitle>
      <p className="mb-4 text-[11.5px] leading-relaxed text-ink-400">
        These are the only inputs to the Risk Agent&apos;s verdict. The Offer Agent cannot read this table —
        that separation is what makes the veto a control rather than a suggestion. Change a number and re-run the
        agents to watch the decision change.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Minimum gross margin" suffix="%" value={v('min_margin_pct')} step={0.5}
          onChange={(n) => setDraft({ ...draft, min_margin_pct: n })}
          hint="Offer price must retain at least this margin over unit cost." />
        <Field label="Maximum discount depth" suffix="%" value={v('max_discount_pct')} step={1}
          onChange={(n) => setDraft({ ...draft, max_discount_pct: n })}
          hint="Cap on how far below list an offer may go." />
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
          hint="Don't discount a SKU that sold at list price inside this window." />
      </div>

      <label className="mt-4 flex cursor-pointer items-center gap-2.5 rounded-lg border border-ink-700 bg-ink-900/50 px-3.5 py-2.5">
        <input type="checkbox" checked={v('require_merchant_approval') === 1}
          onChange={(e) => setDraft({ ...draft, require_merchant_approval: e.target.checked ? 1 : 0 })}
          className="h-3.5 w-3.5 accent-[#5b8def]" />
        <span className="text-[12px] text-ink-100">Require merchant approval before a campaign goes live</span>
        <span className="ml-auto text-[10.5px] text-ink-500">human-in-the-loop</span>
      </label>

      <div className="mt-4 rounded-lg border border-ink-700 bg-ink-900/50 p-3.5">
        <div className="mb-1.5 flex justify-between text-[11.5px]">
          <span className="text-ink-300">Discount budget used today</span>
          <span className="tnum text-ink-100">
            {inr(kpis.discountSpentPaise)} of {inr(kpis.discountBudgetPaise)}
          </span>
        </div>
        <Meter value={kpis.discountSpentPaise} max={kpis.discountBudgetPaise}
          tone={kpis.discountSpentPaise / kpis.discountBudgetPaise > 0.85 ? 'bad' : 'warn'} />
      </div>

      {dirty && (
        <div className="mt-4 flex items-center justify-end gap-2">
          <button className="btn-ghost" onClick={() => setDraft({})}>Discard</button>
          <button className="btn-primary" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save guardrails'}
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, suffix, step = 1, hint }: {
  label: string; value: number; onChange: (n: number) => void; suffix?: string; step?: number; hint?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-[12px] font-medium text-ink-100">{label}</label>
        {suffix && <span className="text-[10.5px] text-ink-500">{suffix}</span>}
      </div>
      <input type="number" step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full rounded-lg border border-ink-600 bg-ink-900 px-3 py-1.5 text-[13px] tnum text-ink-100
                   outline-none transition-colors focus:border-accent" />
      {hint && <p className="mt-1 text-[10.5px] leading-relaxed text-ink-500">{hint}</p>}
    </div>
  );
}
