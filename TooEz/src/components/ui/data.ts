'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Small typed fetch hook with loading / error / retry and SSE-driven refresh. */
export function useApi<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(0);

  const load = useCallback(async (quiet = false) => {
    if (!path) return;
    const seq = ++inflight.current;
    if (!quiet) setLoading(true);
    try {
      const r = await fetch(path, { cache: 'no-store' });
      const j = await readResponse(r);
      if (seq !== inflight.current) return;
      if (!r.ok) throw new Error(j.error ?? `Request failed (${r.status})`);
      setData(j); setError(null);
    } catch (e: any) {
      if (seq === inflight.current) setError(e.message ?? 'Network error');
    } finally {
      if (seq === inflight.current) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load };
}

async function readResponse(r: Response): Promise<any> {
  const text = await r.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { error: text }; }
}

/**
 * Subscribes to the server's event stream so dashboards react the moment a
 * webhook lands. Falls back to polling if the stream is unavailable.
 */
export function useLiveRefresh(onEvent: () => void, intervalMs = 6000) {
  const cb = useRef(onEvent);
  cb.current = onEvent;
  useEffect(() => {
    let es: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => { if (!poll) poll = setInterval(() => cb.current(), intervalMs); };
    try {
      es = new EventSource('/api/stream');
      es.addEventListener('refresh', () => cb.current());
      es.addEventListener('audit', () => cb.current());
      es.onerror = startPolling;
    } catch { startPolling(); }
    return () => { es?.close(); if (poll) clearInterval(poll); };
  }, [intervalMs]);
}

export const inr = (p: number, decimals = false) =>
  '₹' + ((p ?? 0) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: decimals ? 2 : 0, maximumFractionDigits: decimals ? 2 : 0,
  });

export const compactINR = (p: number) => {
  const v = (p ?? 0) / 100;
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
  return '₹' + Math.round(v).toLocaleString('en-IN');
};

export const pct = (n: number, d = 1) => `${(n ?? 0).toFixed(d)}%`;

function asDate(ts: string) {
  if (!ts) return new Date(NaN);
  return new Date(ts.includes('T') ? (ts.endsWith('Z') ? ts : ts + 'Z') : ts.replace(' ', 'T') + 'Z');
}

export function clockTime(ts: string) {
  const d = asDate(ts);
  return Number.isNaN(d.getTime()) ? '—'
    : d.toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function dateTime(ts: string) {
  const d = asDate(ts);
  return Number.isNaN(d.getTime()) ? '—'
    : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
}

export function relTime(ts: string) {
  const d = asDate(ts);
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (Number.isNaN(s)) return '';
  if (s < 60) return `${Math.max(s, 0)}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** Client-side CSV export of whatever the table is currently showing. */
export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
