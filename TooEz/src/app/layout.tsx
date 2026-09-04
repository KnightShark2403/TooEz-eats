import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TooEz — AI Revenue Agents for Agentic Commerce',
  description: 'Detect. Decide. Risk-check. Approve. Transact. Learn.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
