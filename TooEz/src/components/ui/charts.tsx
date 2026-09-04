'use client';

import React, { useId, useMemo, useState } from 'react';

/**
 * Charts are hand-drawn SVG — no charting dependency, no bundle cost, and every
 * colour comes from the theme tokens so both modes stay coherent.
 * One accent series plus a muted comparison; no rainbow palettes.
 */

const fmtINR = (p: number) => '₹' + Math.round(p / 100).toLocaleString('en-IN');

export interface Point { day: string; revenuePaise: number; agentPaise: number; organicPaise: number; orders: number }

export function RevenueChart({ data, height = 232 }: { data: Point[]; height?: number }) {
  const uid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  const W = 1000;
  const H = height;
  const padL = 54, padR = 12, padT = 16, padB = 26;

  const max = Math.max(...data.map((d) => d.revenuePaise), 1);
  const niceMax = niceCeil(max);
  const x = (i: number) => padL + (i / Math.max(data.length - 1, 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - v / niceMax) * (H - padT - padB);

  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d.revenuePaise).toFixed(1)}`).join(' ');
  const area = data.length
    ? `${line} L${x(data.length - 1).toFixed(1)} ${H - padB} L${x(0).toFixed(1)} ${H - padB} Z`
    : '';
  const agentLine = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d.agentPaise).toFixed(1)}`).join(' ');

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * niceMax);
  const active = hover != null ? data[hover] : null;

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} role="img"
        aria-label={`Revenue over the last ${data.length} days`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const i = Math.round(((px - padL) / (W - padL - padR)) * (data.length - 1));
          setHover(Math.max(0, Math.min(data.length - 1, i)));
        }}>
        <defs>
          <linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth="1" />
            <text x={padL - 8} y={y(t) + 3.5} textAnchor="end" fontSize="10.5" fill="var(--text-4)"
              className="tnum">{fmtINR(t)}</text>
          </g>
        ))}

        {area && <path d={area} fill={`url(#g${uid})`} />}
        {/* Agent-driven revenue as a muted beige comparison line. */}
        <path d={agentLine} fill="none" stroke="var(--sand)" strokeWidth="1.6" strokeDasharray="3 3" opacity="0.85" />
        <path d={line} fill="none" stroke="var(--brand)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />

        {data.map((d, i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10.5" fill="var(--text-4)">
            {shortDay(d.day, data.length)}
          </text>
        ))}

        {hover != null && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="var(--brand)" strokeWidth="1" opacity="0.4" />
            <circle cx={x(hover)} cy={y(data[hover].revenuePaise)} r="4.5" fill="var(--surface)" stroke="var(--brand)" strokeWidth="2.2" />
          </>
        )}
      </svg>

      {active && (
        <div className="pointer-events-none absolute top-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11px] shadow"
             style={{ left: `${Math.min(88, Math.max(2, ((hover! / Math.max(data.length - 1, 1)) * 92)))}%` }}>
          <div className="font-medium text-ink">{longDay(active.day)}</div>
          <div className="mt-0.5 tnum text-ink-2">{fmtINR(active.revenuePaise)} total</div>
          <div className="tnum text-ink-3">{fmtINR(active.agentPaise)} agent-driven · {active.orders} orders</div>
        </div>
      )}

      <div className="mt-1 flex items-center gap-4 px-1 text-[11px] text-ink-3">
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-brand" />Total revenue</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ background: 'repeating-linear-gradient(90deg,var(--sand) 0 3px,transparent 3px 6px)' }} />
          Agent-driven
        </span>
      </div>
    </div>
  );
}

function niceCeil(v: number) {
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1))));
  return Math.ceil(v / mag) * mag;
}
function shortDay(day: string, n: number) {
  const d = new Date(day + 'T00:00:00');
  if (n > 31) return d.getDate() === 1 ? d.toLocaleDateString('en-IN', { month: 'short' }) : '';
  if (n > 10) return d.getDate() % 3 === 1 ? String(d.getDate()) : '';
  return d.toLocaleDateString('en-IN', { weekday: 'short' });
}
function longDay(day: string) {
  return new Date(day + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

/* ------------------------------------------------------------------ donut */

export interface Slice { label: string; value: number; tone: string }

export function Donut({ slices, total, centerLabel, size = 168 }: {
  slices: Slice[]; total: number; centerLabel?: string; size?: number;
}) {
  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  const sum = slices.reduce((s, x) => s + x.value, 0) || 1;
  let offset = 0;
  const arcs = slices.map((s) => {
    const frac = s.value / sum;
    const arc = { ...s, dash: frac * c, offset };
    offset += frac * c;
    return arc;
  });
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label="Order status breakdown">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-sunk)" strokeWidth="14" />
        {arcs.map((a) => (
          <circle key={a.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={a.tone} strokeWidth="14"
            strokeDasharray={`${a.dash} ${c - a.dash}`} strokeDashoffset={-a.offset} strokeLinecap="butt" />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[24px] font-semibold leading-none tnum text-ink">{total}</div>
        <div className="mt-1 text-[10.5px] uppercase tracking-wider text-ink-3">{centerLabel ?? 'orders'}</div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- bar list */

export function BarList({ items }: { items: { label: string; value: string; pct: number; sub?: string; tone?: string }[] }) {
  return (
    <div className="space-y-2.5">
      {items.map((i) => (
        <div key={i.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="truncate text-[12.5px] font-medium text-ink">{i.label}</span>
            <span className="shrink-0 text-[12px] tnum text-ink-2">{i.value}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunk">
            <div className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${Math.max(2, i.pct)}%`, background: i.tone ?? 'var(--brand)' }} />
          </div>
          {i.sub && <div className="mt-1 text-[10.5px] text-ink-4">{i.sub}</div>}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- hourly bars */

export function HourlyBars({ data }: { data: { hour: number; n: number }[] }) {
  const byHour = useMemo(() => {
    const m = new Map(data.map((d) => [d.hour, d.n]));
    return Array.from({ length: 24 }, (_, h) => ({ hour: h, n: m.get(h) ?? 0 }));
  }, [data]);
  const max = Math.max(...byHour.map((d) => d.n), 1);
  return (
    <div>
      <div className="flex h-28 items-end gap-[3px]">
        {byHour.map((d) => (
          <div key={d.hour} className="group relative flex-1" title={`${String(d.hour).padStart(2, '0')}:00 — ${d.n} orders`}>
            <div className="w-full rounded-t-[3px] transition-colors"
              style={{ height: `${Math.max(2, (d.n / max) * 100)}%`, background: d.n ? 'var(--brand)' : 'var(--surface-sunk)', opacity: d.n ? 0.85 : 1 }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-ink-4">
        <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
      </div>
    </div>
  );
}
