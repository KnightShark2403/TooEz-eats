'use client';
import { Chip, Meter } from './primitives';
import { inr, pct, relTime } from './format';

export function OpportunityCard({
  opp, selected, onSelect, onRun, running,
}: {
  opp: any; selected: boolean; onSelect: () => void; onRun: () => void; running: boolean;
}) {
  const s = JSON.parse(opp.signals_json || '{}');
  const trendTone = opp.demand_trend === 'FALLING' ? 'bad' : opp.demand_trend === 'RISING' ? 'good' : 'neutral';
  const trendArrow = opp.demand_trend === 'FALLING' ? '↓' : opp.demand_trend === 'RISING' ? '↑' : '→';

  return (
    <button
      onClick={onSelect}
      className={`card w-full p-4 text-left transition-all duration-150 ${
        selected ? 'border-accent/60 ring-1 ring-accent/25' : 'hover:border-ink-600'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[22px] font-semibold leading-none tnum text-accent">
            {inr(opp.value_at_risk_paise)}
          </div>
          <div className="mt-1.5 text-[12px] font-medium text-ink-100">{opp.product_name}</div>
        </div>
        <Chip tone={trendTone as any}>{trendArrow} demand {opp.demand_trend.toLowerCase()}</Chip>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2 border-y border-ink-700/60 py-2.5">
        <Cell k="Inventory" v={`${opp.stock_units} u`} />
        <Cell k="Window" v={`${opp.window_minutes} min`} />
        <Cell k="Sell-through" v={pct(opp.sell_through_pct, 0)} />
        <Cell k="At risk" v={inr(s.inventoryAtRiskPaise ?? 0)} />
      </div>

      <p className="mt-2.5 line-clamp-2 text-[11.5px] leading-relaxed text-ink-300">{opp.rationale}</p>

      <div className="mt-3">
        <div className="mb-1 flex justify-between text-[10.5px] text-ink-400">
          <span>Forecast sell-through in window</span>
          <span className="tnum">{Number(opp.baseline_units).toFixed(1)} of {opp.stock_units} units</span>
        </div>
        <Meter value={Number(opp.baseline_units)} max={opp.stock_units} tone="warn" />
      </div>

      <div className="mt-3.5 flex items-center justify-between">
        <span className="text-[10.5px] text-ink-500">detected {relTime(opp.detected_at)}</span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); if (!running) onRun(); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onRun(); } }}
          className={`btn-primary ${running ? 'pointer-events-none opacity-50' : ''}`}
        >
          {running ? 'Agents running…' : 'Run agents →'}
        </span>
      </div>
    </button>
  );
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-wider text-ink-500">{k}</div>
      <div className="mt-0.5 text-[12.5px] font-medium tnum text-ink-100">{v}</div>
    </div>
  );
}
