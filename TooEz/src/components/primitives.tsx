'use client';
import React from 'react';

export function Stat({
  label, value, sub, accent = 'default', hint,
}: {
  label: string; value: React.ReactNode; sub?: React.ReactNode;
  accent?: 'default' | 'good' | 'accent' | 'warn'; hint?: string;
}) {
  const tone = {
    default: 'text-ink-100',
    good: 'text-good',
    accent: 'text-accent',
    warn: 'text-warn',
  }[accent];
  return (
    <div className="card card-pad" title={hint}>
      <div className="label">{label}</div>
      <div className={`mt-2 text-[26px] font-semibold leading-none tnum ${tone}`}>{value}</div>
      {sub ? <div className="mt-2 text-[12px] leading-snug text-ink-300">{sub}</div> : null}
    </div>
  );
}

export function Chip({
  tone = 'neutral', children, className = '',
}: { tone?: 'neutral' | 'good' | 'bad' | 'warn' | 'accent'; children: React.ReactNode; className?: string }) {
  const map = {
    neutral: 'border-ink-600 bg-ink-800 text-ink-300',
    good: 'border-good/35 bg-good/10 text-good',
    bad: 'border-bad/40 bg-bad/10 text-bad',
    warn: 'border-warn/35 bg-warn/10 text-warn',
    accent: 'border-accent/35 bg-accent/10 text-accent',
  }[tone];
  return <span className={`chip ${map} ${className}`}>{children}</span>;
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[13px] font-semibold tracking-tight text-ink-100">{children}</h2>
      {right}
    </div>
  );
}

export function Meter({ value, max, tone = 'accent' }: { value: number; max: number; tone?: 'accent' | 'warn' | 'bad' }) {
  const p = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  const bar = { accent: 'bg-accent', warn: 'bg-warn', bad: 'bg-bad' }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
      <div className={`h-full rounded-full ${bar} transition-all duration-500`} style={{ width: `${p}%` }} />
    </div>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <div className="text-[13px] font-medium text-ink-200">{title}</div>
      {hint ? <div className="max-w-md text-[12px] leading-relaxed text-ink-400">{hint}</div> : null}
      {action}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className}`} />;
}

export function AgentDot({ actor }: { actor: string }) {
  const map: Record<string, string> = {
    DETECTION_AGENT: 'bg-accent',
    OFFER_AGENT: 'bg-[#a78bfa]',
    RISK_AGENT: 'bg-bad',
    SETTLEMENT_AGENT: 'bg-good',
    MERCHANT: 'bg-warn',
    RAZORPAY: 'bg-[#3395ff]',
    CUSTOMER: 'bg-ink-400',
    SYSTEM: 'bg-ink-500',
  };
  return <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${map[actor] ?? 'bg-ink-500'}`} />;
}

export const ACTOR_LABEL: Record<string, string> = {
  DETECTION_AGENT: 'Detection Agent',
  OFFER_AGENT: 'Offer Agent',
  RISK_AGENT: 'Risk Agent',
  SETTLEMENT_AGENT: 'Settlement Agent',
  MERCHANT: 'Merchant',
  RAZORPAY: 'Razorpay',
  CUSTOMER: 'Customer',
  SYSTEM: 'System',
};
