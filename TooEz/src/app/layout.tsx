import type { Metadata, Viewport } from 'next';
import { ThemeProvider, THEME_BOOTSTRAP } from '@/components/theme';
import './globals.css';

export const metadata: Metadata = {
  title: 'TooEz — Revenue OS for food businesses',
  description: 'Detect. Decide. Risk-check. Approve. Transact. Learn.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applied before first paint so the correct theme is never flashed. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
