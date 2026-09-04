'use client';

import React from 'react';
import { Icon } from './icons';

/* --------------------------------------------------------------- surfaces */

export function Card({
  children, className = '', glass = false, as: As = 'div', ...rest
}: React.HTMLAttributes<HTMLElement> & { glass?: boolean; as?: any }) {
  return (
    <As className={`${glass ? 'glass rounded-xl' : 'card'} ${className}`} {...rest}>
      {children}
    </As>
  );
}

export function SectionHead({
  title, subtitle, right, id,
}: { title: string; subtitle?: string; right?: React.ReactNode; id?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id={id} className="text-[14px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[12px] text-ink-3">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

/* ------------------------------------------------------------------ chips */

export type Tone = 'neutral' | 'brand' | 'good' | 'bad' | 'warn' | 'sand';

const TONE: Record<Tone, string> = {
  neutral: 'border-line bg-surface-2 text-ink-2',
  brand: 'border-brand-border bg-brand-soft text-brand',
  good: 'border-good-border bg-good-soft text-good',
  bad: 'border-bad-border bg-bad-soft text-bad',
  warn: 'border-warn-border bg-warn-soft text-warn',
  sand: 'border-sand-border bg-sand-soft text-sand',
};

export function Chip({ tone = 'neutral', children, className = '', dot = false }: {
  tone?: Tone; children: React.ReactNode; className?: string; dot?: boolean;
}) {
  return (
    <span className={`chip ${TONE[tone]} ${className}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** Canonical status → tone mapping. These are TooEz's real states, nothing invented. */
export const ORDER_TONE: Record<string, Tone> = {
  CREATED: 'neutral',
  AWAITING_CONFIRMATION: 'warn',
  PAID: 'good',
  FAILED: 'bad',
  REFUNDED: 'sand',
  PARTIALLY_REFUNDED: 'sand',
  ABANDONED: 'neutral',
};
export const PAYMENT_TONE: Record<string, Tone> = {
  captured: 'good', authorized: 'warn', failed: 'bad', refunded: 'sand',
};
export const CAMPAIGN_TONE: Record<string, Tone> = {
  LIVE: 'good', PENDING_APPROVAL: 'warn', REJECTED: 'bad', COMPLETED: 'neutral', EXPIRED: 'neutral',
};

/** Razorpay method codes → display labels. UPI/EMI are initialisms. */
export const methodLabel = (m?: string | null) => {
  if (!m) return '—';
  const map: Record<string, string> = {
    upi: 'UPI', card: 'Card', netbanking: 'Netbanking', wallet: 'Wallet',
    emi: 'EMI', paylater: 'Pay Later', bank_transfer: 'Bank transfer',
  };
  return map[m.toLowerCase()] ?? m.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
};

export const humanStatus = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

/* --------------------------------------------------------------- KPI card */

export function StatCard({
  label, value, delta, deltaLabel, sub, spark, tone = 'brand', invertDelta = false, footer, icon,
}: {
  label: string; value: React.ReactNode; delta?: number | null; deltaLabel?: string;
  sub?: React.ReactNode; spark?: number[]; tone?: Tone; invertDelta?: boolean; footer?: React.ReactNode; icon?: React.ReactNode;
}) {
  const good = delta == null ? null : invertDelta ? delta <= 0 : delta >= 0;
  const accent = { brand: 'text-brand', good: 'text-good', bad: 'text-bad', warn: 'text-warn', sand: 'text-sand', neutral: 'text-ink' }[tone];
  const bgSoft = { brand: 'bg-brand-soft text-brand', good: 'bg-good-soft text-good', bad: 'bg-bad-soft text-bad', warn: 'bg-warn-soft text-warn', sand: 'bg-sand-soft text-sand', neutral: 'bg-surface-2 text-ink' }[tone];

  return (
    <Card className="p-5 transition-shadow hover:shadow flex flex-col justify-between h-full">
      <div className="flex items-start justify-between gap-4 mb-4">
        {icon && (
          <div className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center shadow-sm ${bgSoft}`}>
            {icon}
          </div>
        )}
        {!icon && <div className="h-10 w-10" />} {/* Spacer */}
        {spark && spark.length > 1 && (
          <div className="flex-1 max-w-[90px] h-10 ml-auto">
             <Sparkline data={spark} className={good ? 'text-good' : 'text-bad'} w={90} h={36} />
          </div>
        )}
      </div>

      <div>
        <div className="text-[13px] font-medium text-ink-3 mb-1.5">{label}</div>
        <div className="text-[28px] font-bold leading-none tracking-[-0.03em] tnum text-ink">{value}</div>

        {(delta != null || deltaLabel) && (
          <div className="mt-3 flex items-center gap-2">
            {delta != null && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold tnum
                ${good ? 'text-good' : 'text-bad'}`}>
                {delta >= 0 ? '↑' : '↓'}
                {Math.abs(delta).toFixed(1)}%
              </span>
            )}
            {deltaLabel && <span className="text-[11.5px] text-ink-4">{deltaLabel}</span>}
          </div>
        )}
        {sub && <div className="mt-2 text-[11.5px] leading-snug text-ink-3">{sub}</div>}
      </div>
      {footer && <div className="mt-4">{footer}</div>}
    </Card>
  );
}

export function Sparkline({ data, className = '', w = 72, h = 26 }: { data: number[]; className?: string; w?: number; h?: number }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    h - 2 - ((v - min) / span) * (h - 4),
  ]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${d} L${w} ${h} L0 ${h} Z`;
  return (
    <svg width={w} height={h} className={`shrink-0 ${className}`} aria-hidden>
      <path d={area} fill="currentColor" opacity="0.1" />
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ meter */

export function Meter({ value, max, tone = 'brand', className = '' }: { value: number; max: number; tone?: Tone; className?: string }) {
  const p = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
  const bar = { brand: 'bg-brand', good: 'bg-good', bad: 'bg-bad', warn: 'bg-warn', sand: 'bg-sand', neutral: 'bg-ink-3' }[tone];
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-surface-sunk ${className}`}
         role="progressbar" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${bar} transition-[width] duration-500`} style={{ width: `${p}%` }} />
    </div>
  );
}

/* ------------------------------------------------- loading / empty / error */

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="p-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3 px-1 py-2.5">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={`h-3.5 ${c === 0 ? 'w-40' : c === cols - 1 ? 'w-20' : 'flex-1'}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, hint, action, icon }: {
  title: string; hint?: string; action?: React.ReactNode; icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon && <div className="mb-1 text-ink-4">{icon}</div>}
      <div className="text-[13.5px] font-medium text-ink">{title}</div>
      {hint && <p className="max-w-md text-[12px] leading-relaxed text-ink-3">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 px-6 py-10 text-center">
      <span className="text-bad"><Icon.Alert size={22} /></span>
      <div className="text-[13.5px] font-medium text-ink">Something went wrong</div>
      <p className="max-w-md text-[12px] leading-relaxed text-ink-3">{message}</p>
      {onRetry && <button className="btn-ghost mt-1" onClick={onRetry}><Icon.Refresh /> Try again</button>}
    </div>
  );
}

/* ----------------------------------------------------------------- inputs */

export function SearchInput({ value, onChange, placeholder = 'Search…', className = '' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-4"><Icon.Search size={15} /></span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        aria-label={placeholder} className="field !py-1.5 pl-8 text-[12.5px]" />
      {value && (
        <button onClick={() => onChange('')} aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-4 hover:text-ink-2"><Icon.Close size={14} /></button>
      )}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange, size = 'md' }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; size?: 'sm' | 'md';
}) {
  const pad = size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-[12px]';
  return (
    <div role="tablist" className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={`rounded-md font-medium transition-colors ${pad} ${
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink-2'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
