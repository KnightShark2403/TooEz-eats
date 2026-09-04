export const inr = (p: number, decimals = false) =>
  '₹' + (p / 100).toLocaleString('en-IN', {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  });

export const pct = (n: number, d = 1) => `${Number(n).toFixed(d)}%`;

export function clockTime(ts: string) {
  const d = new Date(ts.includes('T') ? (ts.endsWith('Z') ? ts : ts + 'Z') : ts.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function relTime(ts: string) {
  const d = new Date(ts.includes('T') ? (ts.endsWith('Z') ? ts : ts + 'Z') : ts.replace(' ', 'T') + 'Z');
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (Number.isNaN(s)) return '';
  if (s < 60) return `${Math.max(s, 0)}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}
