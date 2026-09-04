'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/icons';

export const NAV = [
  { href: '/dashboard',           label: 'Overview',     icon: Icon.Overview },
  { href: '/dashboard/orders',    label: 'Orders',       icon: Icon.Orders },
  { href: '/dashboard/payments',  label: 'Payments',     icon: Icon.Payments },
  { href: '/dashboard/customers', label: 'Customers',    icon: Icon.Customers },
  { href: '/dashboard/analytics', label: 'Analytics',    icon: Icon.Analytics },
  { href: '/dashboard/agents',    label: 'AI Assistant', icon: Icon.Agent },
  { href: '/dashboard/products',  label: 'Products',     icon: Icon.Products },
  { href: '/dashboard/campaigns', label: 'Campaigns',    icon: Icon.Campaigns },
  { href: '/dashboard/settings',  label: 'Settings',     icon: Icon.Settings },
] as const;

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const path = usePathname();
  const isActive = (href: string) => (href === '/dashboard' ? path === href : path.startsWith(href));

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[2px] lg:hidden" onClick={onClose} aria-hidden />
      )}
      <aside
        className={`glass fixed inset-y-0 left-0 z-40 flex w-[228px] flex-col rounded-none border-y-0 border-l-0
                    transition-transform duration-200 lg:translate-x-0
                    ${open ? 'translate-x-0' : '-translate-x-full'}`}
        aria-label="Main navigation"
      >
        <div className="flex items-center gap-2.5 px-4 py-6">
          <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
            <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-brand text-[14px] font-bold text-[var(--brand-contrast)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-4H8v4H6v-6c0-1.66 1.34-3 3-3s3 1.34 3 3v6h-1zm4 0v-4h-2v4h-2v-6c0-1.66 1.34-3 3-3s3 1.34 3 3v6h-1z" fill="currentColor"/>
              </svg>
            </span>
            <span>
              <span className="block text-[16px] font-semibold leading-none tracking-[-0.02em] text-ink">TooEZ</span>
              <span className="mt-1 block text-[10.5px] leading-none text-ink-3">Good Food. Made Easy.</span>
            </span>
          </Link>
          <button className="ml-auto text-ink-3 hover:text-ink lg:hidden" onClick={onClose} aria-label="Close navigation">
            <Icon.Close />
          </button>
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto px-4 py-2">
          {NAV.map((n) => {
            const active = isActive(n.href);
            const I = n.icon;
            return (
              <Link key={n.href} href={n.href} onClick={onClose}
                aria-current={active ? 'page' : undefined}
                className={`group relative flex items-center justify-between rounded-full px-4 py-2.5 text-[13.5px] font-medium transition-all
                  ${active
                    ? 'bg-brand shadow-md text-[var(--brand-contrast)]'
                    : 'text-ink-2 hover:bg-surface-2 hover:text-ink'}`}>
                <div className="flex items-center gap-3">
                  <I className={active ? 'text-[var(--brand-contrast)]' : 'text-ink-3 group-hover:text-ink-2'} />
                  {n.label}
                </div>
                {n.label === 'AI Assistant' && (
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${active ? 'bg-white/20 text-white' : 'bg-brand-soft text-brand'}`}>Beta</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-6">
          <div className="rounded-xl border border-good-border bg-good-soft px-3 py-3 flex items-center gap-3">
             <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-good text-white shadow-sm">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
             </div>
             <div>
               <div className="text-[12px] font-semibold text-good">Test Mode</div>
               <div className="text-[10px] text-good opacity-80 mt-0.5">Using Razorpay Test API</div>
             </div>
          </div>
        </div>
      </aside>
    </>
  );
}
