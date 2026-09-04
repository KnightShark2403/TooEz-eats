'use client';

import { Card, Chip, Meter } from '@/components/ui/kit';
import { Icon } from '@/components/ui/icons';
import { inr, pct, relTime } from '@/components/ui/data';

export function OpportunityCard({ opp, selected, onSelect, onRun, running }: {
  opp: any; selected: boolean; onSelect: () => void; onRun: () => void; running: boolean;
}) {
  const s = JSON.parse(opp.signals_json || '{}');
  const tone = opp.demand_trend === 'FALLING' ? 'bad' : opp.demand_trend === 'RISING' ? 'good' : 'neutral';
  const arrow = opp.demand_trend === 'FALLING' ? '↓' : opp.demand_trend === 'RISING' ? '↑' : '→';

  return (
    <Card className={`p-4 transition-all ${selected ? 'border-brand-border ring-1 ring-brand-border' : 'hover:border-line-strong'}`}>
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect();
          }
        }}
        className="w-full cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-border focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        aria-pressed={selected}
        aria-label={`Select ${opp.product_name} opportunity`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[22px] font-semibold leading-none tnum text-brand">{inr(opp.value_at_risk_paise)}</div>
            <div className="mt-1.5 text-[12.5px] font-medium text-ink">{opp.product_name}</div>
          </div>
          <Chip tone={tone as any}>{arrow} demand {opp.demand_trend.toLowerCase()}</Chip>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2 border-y border-line py-2.5">
          <Cell k="Inventory" v={`${opp.stock_units} u`} />
          <Cell k="Window" v={`${opp.window_minutes} min`} />
          <Cell k="Sell-through" v={pct(opp.sell_through_pct, 0)} />
          <Cell k="At risk" v={inr(s.inventoryAtRiskPaise ?? 0)} />
        </div>

        <p className="mt-2.5 line-clamp-2 text-[11.5px] leading-relaxed text-ink-3">{opp.rationale}</p>

        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[10.5px] text-ink-4">
            <span>Forecast sell-through in window</span>
            <span className="tnum">{Number(opp.baseline_units).toFixed(1)} of {opp.stock_units} units</span>
          </div>
          <Meter value={Number(opp.baseline_units)} max={opp.stock_units} tone="warn" />
        </div>
      </div>

      <div className="mt-3.5 flex items-center justify-between">
        <span className="text-[10.5px] text-ink-4">detected {relTime(opp.detected_at)}</span>
        <button type="button" className="btn-primary" onClick={onRun} disabled={running}>
          {running ? 'Agents running…' : <><Icon.Sparkle /> Run agents</>}
        </button>
      </div>
    </Card>
  );
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-wider text-ink-4">{k}</div>
      <div className="mt-0.5 text-[12.5px] font-medium tnum text-ink">{v}</div>
    </div>
  );
}
