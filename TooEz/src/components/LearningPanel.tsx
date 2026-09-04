'use client';
import { Chip, SectionTitle } from './primitives';
import { inr, pct } from './format';

export function LearningPanel({ learning }: { learning: any[] }) {
  const byProduct = learning.reduce<Record<string, any[]>>((acc, r) => {
    (acc[r.product_name] ||= []).push(r);
    return acc;
  }, {});

  return (
    <div className="card card-pad">
      <SectionTitle right={<Chip tone="neutral">updated on every captured payment</Chip>}>
        Learned price response
      </SectionTitle>
      <p className="mb-4 text-[11.5px] leading-relaxed text-ink-400">
        Every settled campaign writes its impressions and conversions back here. The Offer Agent blends these
        observations with a logistic elasticity prior, so a price point with real evidence outweighs the model&apos;s
        guess. This is the whole learning loop — no reinforcement learning, just outcomes changing the next decision.
      </p>

      {Object.keys(byProduct).length === 0 && (
        <div className="py-6 text-center text-[12px] text-ink-500">No outcomes recorded yet.</div>
      )}

      <div className="space-y-5">
        {Object.entries(byProduct).map(([name, rows]) => {
          const maxRate = Math.max(...rows.map((r) => (r.impressions ? r.conversions / r.impressions : 0)), 0.001);
          const best = rows.reduce((a, b) =>
            (b.conversions / Math.max(b.impressions, 1)) > (a.conversions / Math.max(a.impressions, 1)) ? b : a);
          return (
            <div key={name}>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-[12.5px] font-medium text-ink-100">{name}</span>
                <span className="text-[11px] text-ink-400">
                  best observed: <b className="tnum text-good">{inr(best.price_paise)}</b>
                </span>
              </div>
              <div className="space-y-1.5">
                {rows.sort((a, b) => b.price_paise - a.price_paise).map((r) => {
                  const rate = r.impressions ? r.conversions / r.impressions : 0;
                  return (
                    <div key={r.id} className="flex items-center gap-3">
                      <span className="w-14 shrink-0 text-right text-[12px] font-medium tnum text-ink-100">
                        {inr(r.price_paise)}
                      </span>
                      <div className="h-5 flex-1 overflow-hidden rounded bg-ink-800">
                        <div
                          className={`flex h-full items-center justify-end rounded pr-2 text-[10px] font-semibold tnum ${
                            r.id === best.id ? 'bg-good/70 text-[#04180e]' : 'bg-accent/45 text-ink-100'}`}
                          style={{ width: `${Math.max(8, (rate / maxRate) * 100)}%` }}>
                          {pct(rate * 100, 1)}
                        </div>
                      </div>
                      <span className="w-32 shrink-0 text-right text-[10.5px] tnum text-ink-400">
                        {r.conversions}/{r.impressions} · {inr(r.revenue_paise)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
