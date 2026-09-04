/**
 * Money is always integer PAISE inside TooEz. Rupee floats never touch the database.
 * Razorpay's API also speaks paise, so there is exactly one conversion point: display.
 */
export const paise = (rupees: number) => Math.round(rupees * 100);
export const rupees = (p: number) => p / 100;

export function inr(p: number, opts: { decimals?: boolean } = {}): string {
  const v = p / 100;
  return '₹' + v.toLocaleString('en-IN', {
    minimumFractionDigits: opts.decimals ? 2 : 0,
    maximumFractionDigits: opts.decimals ? 2 : 0,
  });
}

export const pct = (n: number, d = 1) => `${n.toFixed(d)}%`;

/** Gross margin percentage of a sale at `price` given unit cost `cogs`. */
export function marginPct(pricePaise: number, cogsPaise: number): number {
  if (pricePaise <= 0) return -100;
  return ((pricePaise - cogsPaise) / pricePaise) * 100;
}

/** Discount off list, as a percentage. */
export function discountPct(listPaise: number, pricePaise: number): number {
  if (listPaise <= 0) return 0;
  return ((listPaise - pricePaise) / listPaise) * 100;
}
