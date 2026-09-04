import { Icon } from '@/components/ui/icons';
import Image from 'next/image';
import Link from 'next/link';

export function BannerSidebar() {
  return (
    <aside className="hidden xl:flex w-[320px] flex-col border-l border-line h-full fixed right-0 top-0 z-10 bg-surface">
      <div className="flex-1 relative overflow-hidden flex flex-col pt-12 px-8">
        {/* Logo */}
        <div className="absolute top-6 left-8 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-brand text-[12px] font-bold text-[var(--brand-contrast)]">T</span>
          <span className="font-semibold text-ink text-[14px]">TooEZ</span>
        </div>
        
        {/* Light Mode Content */}
        <div className="dark:hidden">
          <h2 className="text-[32px] font-bold leading-tight mt-12 text-ink">
            Power delicious <span className="text-brand">growth.</span>
          </h2>
          <p className="mt-4 text-[14px] text-ink-3 leading-relaxed">
            A modern dashboard for modern food businesses. Track, manage and grow — effortlessly.
          </p>
        </div>

        {/* Dark Mode Content */}
        <div className="hidden dark:block">
          <h2 className="text-[32px] font-bold leading-tight mt-12 text-ink">
            Insights that serve <span className="text-brand">you.</span>
          </h2>
          <p className="mt-4 text-[14px] text-ink-3 leading-relaxed">
            Real-time payments, orders and customer insights — beautifully simplified.
          </p>
        </div>
        
        {/* Decorative Card */}
        <div className="mt-auto mb-16 relative w-full h-[240px] rounded-2xl overflow-hidden glass shadow-lg border border-border-glass">
          <div className="absolute inset-0 bg-brand-soft opacity-30 mix-blend-multiply"></div>
          
          <div className="absolute bottom-6 left-6 right-6 dark:hidden">
            <Link href="/dashboard/orders" className="glass block rounded-xl p-4 flex flex-col gap-2 border border-line-strong backdrop-blur-md bg-surface-glass hover:border-brand-border transition-colors group">
               <div className="flex items-center gap-3">
                 <div className="h-8 w-8 rounded-lg bg-brand-soft text-brand flex items-center justify-center transition-transform group-hover:scale-105">
                   <Icon.Orders size={18} />
                 </div>
                 <div>
                   <div className="text-[11px] text-ink-3">Orders this week</div>
                   <div className="flex items-baseline gap-2">
                     <span className="text-[20px] font-bold text-ink">187</span>
                     <span className="text-[11px] font-medium text-good">↑ 8.3%</span>
                   </div>
                 </div>
               </div>
            </Link>
          </div>

          <div className="absolute bottom-6 left-6 right-6 hidden dark:block">
            <Link href="/dashboard/agents" className="glass block rounded-xl p-4 flex flex-col gap-2 border border-line-strong backdrop-blur-md bg-surface-glass hover:border-brand-border transition-colors group">
               <div className="flex items-center gap-3">
                 <div className="h-8 w-8 rounded-lg bg-brand-soft text-brand flex items-center justify-center transition-transform group-hover:scale-105">
                   <Icon.Agent size={18} />
                 </div>
                 <div>
                   <div className="flex items-center gap-2">
                     <span className="text-[12px] font-bold text-ink group-hover:text-brand transition-colors">AI Assistant</span>
                     <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-brand-soft text-brand uppercase font-bold">Beta</span>
                   </div>
                   <div className="mt-1 text-[10px] text-ink-3 leading-snug">Get personalized growth recommendations</div>
                 </div>
               </div>
            </Link>
          </div>
        </div>
        
        <div className="text-[13px] text-ink-4 pb-8 dark:hidden">
          Built for food entrepreneurs who dream bigger.
        </div>
        <div className="text-[13px] text-ink-4 pb-8 hidden dark:block">
          Food today. A better tomorrow.
        </div>
      </div>
    </aside>
  );
}
