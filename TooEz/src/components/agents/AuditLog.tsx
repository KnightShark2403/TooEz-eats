'use client';

import { useState } from 'react';
import { Card, Chip } from '@/components/ui/kit';
import { clockTime } from '@/components/ui/data';

export const ACTOR_LABEL: Record<string, string> = {
  DETECTION_AGENT: 'Detection Agent', OFFER_AGENT: 'Offer Agent', RISK_AGENT: 'Risk Agent',
  SETTLEMENT_AGENT: 'Settlement Agent', MERCHANT: 'Merchant', RAZORPAY: 'Razorpay',
  CUSTOMER: 'Customer', SYSTEM: 'System',
};

const DOT: Record<string, string> = {
  DETECTION_AGENT: 'bg-brand', OFFER_AGENT: 'bg-sand', RISK_AGENT: 'bg-bad',
  SETTLEMENT_AGENT: 'bg-good', MERCHANT: 'bg-warn', RAZORPAY: 'bg-brand',
  CUSTOMER: 'bg-ink-3', SYSTEM: 'bg-ink-4',
};

const SEV: Record<string, string> = {
  info: 'text-ink-2', success: 'text-good', warn: 'text-warn', veto: 'text-bad', error: 'text-bad',
};

export function AuditLog({ rows, maxHeight = 'max-h-[520px]' }: { rows: any[]; maxHeight?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const [filter, setFilter] = useState('ALL');
  const actors = ['ALL', ...Array.from(new Set(rows.map((r) => r.actor)))];
  const shown = filter === 'ALL' ? rows : rows.filter((r) => r.actor === filter);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-good opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-good" />
          </span>
          <h2 className="text-[13px] font-semibold text-ink">Audit trail</h2>
          <span className="text-[11px] text-ink-4">{rows.length} entries</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {actors.map((a) => (
            <button key={a} onClick={() => setFilter(a)}
              className={`rounded-md px-2 py-1 text-[10.5px] transition-colors ${
                filter === a ? 'bg-surface-sunk text-ink' : 'text-ink-4 hover:text-ink-2'}`}>
              {a === 'ALL' ? 'All' : (ACTOR_LABEL[a] ?? a)}
            </button>
          ))}
        </div>
      </div>

      <div className={`divide-y divide-[color:var(--border)] overflow-y-auto ${maxHeight}`}>
        {shown.length === 0 && <div className="px-4 py-8 text-center text-[12px] text-ink-4">No entries yet.</div>}
        {shown.map((r) => (
          <div key={r.id}>
            <button onClick={() => setOpen(open === r.id ? null : r.id)}
              className="flex w-full items-start gap-3 px-4 py-2 text-left transition-colors hover:bg-surface-2">
              <span className="mt-0.5 shrink-0 font-mono text-[10.5px] tnum text-ink-4">{clockTime(r.ts)}</span>
              <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${DOT[r.actor] ?? 'bg-ink-4'}`} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[11px] font-medium text-ink-3">{ACTOR_LABEL[r.actor] ?? r.actor}</span>
                  <span className="font-mono text-[9.5px] uppercase tracking-wider text-ink-4">{r.action}</span>
                </span>
                <span className={`mt-0.5 block text-[12px] leading-snug ${SEV[r.severity] ?? 'text-ink-2'}`}>{r.summary}</span>
              </span>
              {r.severity === 'veto' && <Chip tone="bad" className="mt-0.5 shrink-0">VETO</Chip>}
            </button>
            {open === r.id && r.detail_json && (
              <pre className="mx-4 mb-3 max-h-64 overflow-auto rounded-lg border border-line bg-surface-sunk p-3 font-mono text-[10.5px] leading-relaxed text-ink-2">
                {JSON.stringify(JSON.parse(r.detail_json), null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
