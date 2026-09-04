'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/icons';
import { Chip } from '@/components/ui/kit';
import { useTheme } from '@/components/theme';
import { NAV } from './Sidebar';

export function Topbar({
  merchantName, gateway, onMenu, alerts,
}: {
  merchantName: string;
  gateway: { mode: string; testMode: boolean; keyId: string | null; webhookConfigured: boolean; problems?: string[]; warnings?: string[] } | null;
  onMenu: () => void;
  alerts: { severity: string; summary: string; ts: string }[];
}) {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [q, setQ] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'Escape') { setShowNotes(false); searchRef.current?.blur(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (notesRef.current && !notesRef.current.contains(e.target as Node)) setShowNotes(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    const page = NAV.find((n) => n.label.toLowerCase() === term.toLowerCase());
    if (page) { router.push(page.href); setQ(''); return; }
    router.push(term.startsWith('pay_') ? `/dashboard/payments?q=${encodeURIComponent(term)}`
                                        : `/dashboard/orders?q=${encodeURIComponent(term)}`);
  };

  const unread = alerts.filter((a) => a.severity === 'veto' || a.severity === 'error' || a.severity === 'warn').length;
  const configProblem = (gateway?.problems?.length ?? 0) > 0;

  return (
    <header className="glass sticky top-0 z-20 rounded-none border-x-0 border-t-0">
      <div className="flex items-center gap-3 px-4 py-2.5 lg:px-6">
        <button className="text-ink-2 lg:hidden" onClick={onMenu} aria-label="Open navigation"><Icon.Menu /></button>

        <form onSubmit={submit} className="relative hidden min-w-0 flex-1 sm:block sm:max-w-sm">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-4"><Icon.Search size={15} /></span>
          <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search orders, payments, customers…" aria-label="Search"
            className="field !py-1.5 pl-8 pr-14 text-[12.5px]" />
          <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-line
                          bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-4 md:block">⌘K</kbd>
        </form>

        <div className="flex-1 flex justify-center hidden lg:flex">
           <span className="text-[10px] font-bold tracking-[0.2em] text-ink-3 uppercase">Good Food. Happier People. Bigger Possibilities</span>
        </div>

        <div className="ml-auto flex items-center gap-4">
          {gateway && (
            <span className="hidden xl:inline-flex" title={gateway.keyId ? `Key ${gateway.keyId}` : undefined}>
              <Chip tone={configProblem ? 'bad' : gateway.mode === 'razorpay' ? (gateway.testMode ? 'warn' : 'good') : 'neutral'} dot>
                {configProblem ? 'CONFIG ERROR'
                  : gateway.mode === 'razorpay'
                    ? (gateway.testMode ? 'TEST MODE · Razorpay Test API' : 'LIVE MODE')
                    : 'MOCK GATEWAY'}
              </Chip>
            </span>
          )}
          <div className="relative" ref={notesRef}>
            <button onClick={() => setShowNotes((s) => !s)} aria-label="Notifications" aria-expanded={showNotes}
              className="relative rounded-full p-2 text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">
              <Icon.Bell size={18} />
              {unread > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-bad border border-surface" />}
            </button>
            {showNotes && (
              <div className="fade-up absolute right-0 top-10 z-30 w-[330px] overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
                <div className="border-b border-line px-3.5 py-2.5 text-[12px] font-semibold text-ink">Recent activity</div>
                <div className="max-h-80 overflow-y-auto">
                  {alerts.length === 0 && <div className="px-3.5 py-6 text-center text-[12px] text-ink-3">Nothing yet.</div>}
                  {alerts.slice(0, 12).map((a, i) => (
                    <div key={i} className="border-b border-line px-3.5 py-2.5 last:border-0">
                      <div className={`text-[12px] leading-snug ${
                        a.severity === 'veto' || a.severity === 'error' ? 'text-bad'
                        : a.severity === 'warn' ? 'text-warn'
                        : a.severity === 'success' ? 'text-good' : 'text-ink-2'}`}>{a.summary}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            className="rounded-full p-2 text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">
            {theme === 'dark' ? <Icon.Sun size={18} /> : <Icon.Moon size={18} />}
          </button>

          <div className="flex items-center gap-3 pl-2">
            <div className="hidden text-right sm:block">
              <div className="text-[13px] font-bold leading-tight text-ink">Vetri</div>
              <div className="text-[11px] leading-tight text-ink-3">Admin</div>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-[14px] font-bold text-[var(--brand-contrast)] shadow-sm">
              V
            </span>
          </div>
        </div>
      </div>

      {configProblem && (
        <div className="border-t border-bad-border bg-bad-soft px-4 py-2 text-[12px] text-bad lg:px-6">
          <b>Razorpay configuration problem.</b> {gateway!.problems!.join(' ')}
        </div>
      )}
    </header>
  );
}

function initials(name: string) {
  return name.split(/[\s—-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'M';
}
