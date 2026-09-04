'use client';
import { useState } from 'react';
import { AgentDot, ACTOR_LABEL, Chip } from './primitives';
import { clockTime } from './format';

const SEV: Record<string, string> = {
  info: 'text-ink-200',
  success: 'text-good',
  warn: 'text-warn',
  veto: 'text-bad',
  error: 'text-bad',
};

export function AuditLog({ rows, compact = false }: { rows: any[]; compact?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const [filter, setFilter] = useState<string>('ALL');
  const actors = ['ALL', ...Array.from(new Set(rows.map((r) => r.actor)))];
  const shown = filter === 'ALL' ? rows : rows.filter((r) => r.actor === filter);

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-700/70 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-good opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-good" />
          </span>
          <h2 className="text-[13px] font-semibold text-ink-100">Audit trail</h2>
          <span className="text-[11px] text-ink-500">{rows.length} entries</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {actors.map((a) => (
            <button key={a} onClick={() => setFilter(a)}
              className={`rounded-md px-2 py-1 text-[10.5px] transition-colors ${
                filter === a ? 'bg-ink-700 text-ink-100' : 'text-ink-400 hover:text-ink-200'}`}>
              {a === 'ALL' ? 'All' : (ACTOR_LABEL[a] ?? a)}
            </button>
          ))}
        </div>
      </div>

      <div className={`divide-y divide-ink-800 overflow-y-auto ${compact ? 'max-h-[420px]' : 'max-h-[520px]'}`}>
        {shown.length === 0 && <div className="px-4 py-8 text-center text-[12px] text-ink-500">No entries yet.</div>}
        {shown.map((r) => (
          <div key={r.id} className="row-in">
            <button onClick={() => setOpen(open === r.id ? null : r.id)}
              className="flex w-full items-start gap-3 px-4 py-2 text-left transition-colors hover:bg-ink-800/40">
              <span className="mt-1 shrink-0 font-mono text-[10.5px] tnum text-ink-500">{clockTime(r.ts)}</span>
              <span className="mt-[7px]"><AgentDot actor={r.actor} /></span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[11px] font-medium text-ink-300">{ACTOR_LABEL[r.actor] ?? r.actor}</span>
                  <span className="font-mono text-[9.5px] uppercase tracking-wider text-ink-600">{r.action}</span>
                </span>
                <span className={`mt-0.5 block text-[12px] leading-snug ${SEV[r.severity] ?? 'text-ink-200'}`}>
                  {r.summary}
                </span>
              </span>
              {r.severity === 'veto' && <Chip tone="bad" className="mt-0.5 shrink-0">VETO</Chip>}
            </button>
            {open === r.id && r.detail_json && (
              <pre className="mx-4 mb-3 max-h-64 overflow-auto rounded-lg border border-ink-700 bg-ink-950/80 p-3 font-mono text-[10.5px] leading-relaxed text-ink-300">
                {JSON.stringify(JSON.parse(r.detail_json), null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
