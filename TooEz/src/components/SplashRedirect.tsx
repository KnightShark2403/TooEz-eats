'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SplashRedirect() {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(() => router.replace('/dashboard'), 1500);
    return () => window.clearTimeout(timer);
  }, [router]);

  return (
    <main className="splash-screen" aria-label="TooEz loading">
      <div className="splash-logo" aria-label="tooEz">
        <span>too</span><strong>Ez</strong>
      </div>
      <p className="splash-tagline">Revenue, made easy.</p>
      <span className="splash-loader" aria-hidden="true" />
    </main>
  );
}