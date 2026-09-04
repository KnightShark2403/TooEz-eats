'use client';

import { useCallback, useState } from 'react';
import { Sidebar } from '@/components/shell/Sidebar';
import { Topbar } from '@/components/shell/Topbar';
import { BannerSidebar } from '@/components/shell/BannerSidebar';
import { useApi, useLiveRefresh } from '@/components/ui/data';

/**
 * Dashboard shell. Every page inside it consumes the /api/dashboard/* endpoints
 * — the dashboard never talks to Razorpay, and never sees a privileged credential.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const { data, reload } = useApi<any>('/api/state');
  useLiveRefresh(useCallback(() => reload(true), [reload]));

  const merchantName = data?.merchant?.name ?? 'TooEz merchant';
  const alerts = (data?.audit ?? []).map((a: any) => ({ severity: a.severity, summary: a.summary, ts: a.ts }));

  return (
    <div className="min-h-screen">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="lg:pl-[228px] xl:pr-[320px]">
        <Topbar merchantName={merchantName} gateway={data?.gateway ?? null}
          onMenu={() => setNavOpen(true)} alerts={alerts} />
        <main className="dashboard-grid mx-auto min-h-[calc(100vh-57px)] w-full px-4 py-5 lg:px-6 lg:py-6">{children}</main>
      </div>
      <BannerSidebar />
    </div>
  );
}
