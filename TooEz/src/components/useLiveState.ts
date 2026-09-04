'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface LiveState {
  data: any | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  lastEvent: string | null;
}

/**
 * Loads /api/state and re-fetches whenever the server pushes an SSE event.
 * Falls back to polling if the event stream is unavailable.
 */
export function useLiveState(): LiveState {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const inflight = useRef(false);

  const refresh = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const r = await fetch('/api/state', { cache: 'no-store' });
      if (!r.ok) throw new Error(`state ${r.status}`);
      setData(await r.json());
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      inflight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    let es: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    try {
      es = new EventSource('/api/stream');
      const bump = (label: string) => { setLastEvent(label); refresh(); };
      es.addEventListener('audit', () => bump('audit'));
      es.addEventListener('refresh', (e: any) => {
        try { bump(JSON.parse(e.data).reason); } catch { bump('refresh'); }
      });
      es.onerror = () => { if (!poll) poll = setInterval(refresh, 4000); };
    } catch {
      poll = setInterval(refresh, 4000);
    }
    return () => { es?.close(); if (poll) clearInterval(poll); };
  }, [refresh]);

  return { data, loading, error, refresh, lastEvent };
}
