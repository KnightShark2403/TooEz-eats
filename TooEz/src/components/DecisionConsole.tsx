'use client';
import { useEffect, useState } from 'react';
import { Chip, SectionTitle, Empty, Skeleton } from './primitives';
import { inr, pct, clockTime } from './format';

export function DecisionConsole({
  opportunityId, onChanged, version,
}: { opportunityId: string | null; onChanged: () => void; version?: string | number }) {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    if (!opportunityId) { setD(null); return; }
    setLoading(true);
    try {
      const r = await fetch(`/api/opportunity/${opportunityId}`, { cache: 'no-store' });
      setD(r.ok ? await r.json() : null);
    } finally { setLoading(false); }
  };

  // `version` advances whenever the dashboard state changes (an agent acted, a
  // webhook landed), so the console stays in step with the live audit stream.
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [opportunityId, version]);

  const act = async (url: string, body?: unknown) => {
    setBusy(url);
    try {
      await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });
      await load(); onChanged();
    } finally { setBusy(null); }
  };

  if (!opportunityId) {
    return <Empty title="No opportunity selected"
      hint="Pick an opportunity on the left, then run the agents. The full Detection → Offer → Risk → Approval trail appears here." />;
  }
  if (loading && !d) return <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-40" /></div>;
  if (!d) return <Empty title="Opportunity not found" />;

  const { opportunity: o, signals: s, rounds, campaign, ladder } = d;
  const vetoed = rounds.filter((r: any) => r.decision?.verdict === 'VETOED');
  const approved = rounds.find((r: any) => r.decision?.verdict === 'APPROVED');

  return (
    <div className="space-y-3">
      {/* ---- Detection ------------------------------------------------ */}
      <div className="card card-pad">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              <span className="label !text-accent">Detection Agent</span>
            </div>
            <div className="mt-2 text-[19px] font-semibold tnum text-ink-100">
              {inr(o.value_at_risk_paise)} <span className="text-[13px] font-normal text-ink-300">recoverable</span>
            </div>
          </div>
          <Chip tone="neutral">deterministic forecast · no LLM</Chip>
        </div>
        <p className="mt-2.5 text-[12px] leading-relaxed text-ink-200">{o.rationale}</p>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 border-t border-ink-700/60 pt-3 sm:grid-cols-3">
          <KV k="Demand now" v={`${s.avgUnitsThisHour} u/hr`} />
          <KV k="Demand next hour" v={`${s.avgUnitsNextHour} u/hr`} />
          <KV k="Forecast audience" v={`${s.audienceEstimate} views`} />
          <KV k="Sells at list price" v={`${s.baselineUnits} of ${s.stockUnits} u`} />
          <KV k="Inventory at risk" v={inr(s.inventoryAtRiskPaise)} />
          <KV k="Shelf life left" v={s.minutesOfShelfLifeLeft != null ? `${s.minutesOfShelfLifeLeft} min` : '—'} />
        </div>
      </div>

      {/* ---- Negotiation rounds ---------------------------------------- */}
      {rounds.length === 0 ? (
        <Empty title="Agents have not run yet" hint="Hit “Run agents” on the opportunity card to start the Offer ⇄ Risk negotiation." />
      ) : (
        rounds.map((r: any) => <Round key={r.offer.id} round={r} listPaise={o.list_price_paise} />)
      )}

      {/* ---- Merchant approval gate ------------------------------------ */}
      {campaign && (
        <div className={`card card-pad ${campaign.status === 'PENDING_APPROVAL' ? 'border-warn/40' : ''}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="label">Merchant approval gate</div>
              <div className="mt-1.5 text-[13px] text-ink-100">
                {campaign.status === 'PENDING_APPROVAL'
                  ? <>Campaign drafted at <b className="tnum">{inr(campaign.price_paise)}</b> × {campaign.units_offered} units. Nothing is sellable until you approve.</>
                  : campaign.status === 'REJECTED'
                    ? 'You rejected this campaign. No order can be created.'
                    : <>Campaign <b>{campaign.status.toLowerCase()}</b> — {campaign.units_sold}/{campaign.units_offered} units sold, {inr(campaign.revenue_paise)} booked.</>}
              </div>
            </div>
            <div className="flex gap-2">
              {campaign.status === 'PENDING_APPROVAL' && (
                <>
                  <button className="btn-bad" disabled={!!busy}
                    onClick={() => act(`/api/campaigns/${campaign.id}/reject`, { reason: 'Merchant declined' })}>
                    Reject
                  </button>
                  <button className="btn-good" disabled={!!busy}
                    onClick={() => act(`/api/campaigns/${campaign.id}/approve`)}>
                    {busy ? 'Approving…' : 'Approve campaign'}
                  </button>
                </>
              )}
              {(campaign.status === 'LIVE' || campaign.status === 'COMPLETED') && (
                <a className="btn-primary" href={`/shop/${campaign.id}`} target="_blank" rel="noreferrer">
                  Open customer checkout ↗
                </a>
              )}
            </div>
          </div>
          {campaign.status === 'LIVE' && (
            <div className="mt-3 rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2 text-[11.5px] text-ink-300">
              Share <code className="rounded bg-ink-800 px-1.5 py-0.5 text-ink-100">/shop/{campaign.id}</code> — this is the
              only surface where a Razorpay order can be created for this offer.
            </div>
          )}
        </div>
      )}

      {/* ---- Price ladder transparency --------------------------------- */}
      {ladder?.length > 0 && (
        <div className="card card-pad">
          <SectionTitle right={<Chip tone="neutral">learning loop</Chip>}>Price ladder the Offer Agent optimised over</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="text-left text-ink-500">
                  <Th>Price</Th><Th>Discount</Th><Th>Conv. rate</Th><Th>Evidence</Th>
                  <Th>Exp. units</Th><Th>Exp. revenue</Th><Th>Margin</Th>
                </tr>
              </thead>
              <tbody className="tnum">
                {ladder.map((p: any) => {
                  const isChosen = approved && p.price_paise === approved.offer.offer_price_paise;
                  const wasVetoed = vetoed.some((v: any) => v.offer.offer_price_paise === p.price_paise);
                  return (
                    <tr key={p.price_paise}
                        className={`border-t border-ink-800 ${isChosen ? 'bg-good/[0.07]' : wasVetoed ? 'bg-bad/[0.07]' : ''}`}>
                      <Td className="font-medium text-ink-100">
                        {inr(p.price_paise)}
                        {isChosen && <span className="ml-1.5 text-good">✓</span>}
                        {wasVetoed && <span className="ml-1.5 text-bad">✕</span>}
                      </Td>
                      <Td>{pct(p.discount_pct, 1)}</Td>
                      <Td>{pct(p.conversion_rate * 100, 1)}</Td>
                      <Td className="!font-sans text-ink-400">
                        {p.observed_impressions > 0
                          ? `${p.observed_conversions}/${p.observed_impressions} observed`
                          : 'prior only'}
                      </Td>
                      <Td>{p.expected_conversions.toFixed(1)}</Td>
                      <Td className="text-ink-100">{inr(p.expected_revenue_paise)}</Td>
                      <Td className={p.margin_pct < 22 ? 'text-bad' : 'text-ink-200'}>{pct(p.margin_pct, 1)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2.5 text-[11px] leading-relaxed text-ink-400">
            Conversion rates blend observed outcomes from past campaigns with a logistic elasticity prior
            (Bayesian shrinkage). Rows marked “observed” carry real conversion data — that is the learning loop
            changing today&apos;s recommendation.
          </p>
        </div>
      )}
    </div>
  );
}

function Round({ round, listPaise }: { round: any; listPaise: number }) {
  const { offer, decision } = round;
  const veto = decision?.verdict === 'VETOED';
  return (
    <div className="space-y-2">
      {/* Offer Agent */}
      <div className="card card-pad">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#a78bfa]" />
              <span className="label" style={{ color: '#a78bfa' }}>Offer Agent · attempt {offer.attempt}</span>
              <Chip tone="neutral">{offer.strategy.replace('_', ' ').toLowerCase()}</Chip>
              {offer.reasoning_source === 'llm' && <Chip tone="accent">LLM narration</Chip>}
            </div>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[24px] font-semibold leading-none tnum text-ink-100">{inr(offer.offer_price_paise)}</span>
              <span className="text-[12px] text-ink-400 line-through tnum">{inr(listPaise)}</span>
              <Chip tone="neutral">{pct(offer.discount_pct, 1)} off</Chip>
              <Chip tone={offer.margin_pct < 0 ? 'bad' : 'neutral'}>{pct(offer.margin_pct, 1)} margin</Chip>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="label">Expected</div>
            <div className="mt-1 text-[15px] font-semibold tnum text-ink-100">{inr(offer.expected_revenue_paise)}</div>
            <div className="text-[11px] text-ink-400 tnum">{Number(offer.expected_conversions).toFixed(1)} conversions</div>
          </div>
        </div>
        <p className="mt-2.5 border-t border-ink-700/60 pt-2.5 text-[12px] leading-relaxed text-ink-200">
          {offer.reasoning}
        </p>
      </div>

      {/* Risk Agent */}
      {decision && (
        <div className={`card card-pad ${veto ? 'veto-pulse border-bad/60 bg-bad/[0.06]' : 'border-good/40'}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${veto ? 'bg-bad' : 'bg-good'}`} />
              <span className={`label ${veto ? '!text-bad' : '!text-good'}`}>Independent Risk Agent</span>
            </div>
            <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-semibold ${
              veto ? 'bg-bad/15 text-bad' : 'bg-good/15 text-good'}`}>
              {veto ? '✕  VETOED' : '✓  APPROVED'}
            </div>
          </div>

          {veto && (
            <div className="mt-3 rounded-lg border border-bad/35 bg-bad/[0.07] px-3.5 py-2.5">
              <div className="text-[12.5px] font-medium text-bad">
                Offer blocked before any financial action. No campaign was created, so no Razorpay order can exist for this price.
              </div>
              <div className="mt-1 text-[11.5px] text-ink-300">{decision.primary_reason}</div>
            </div>
          )}

          <div className="mt-3 space-y-1">
            {decision.checks.map((c: any) => (
              <div key={c.rule}
                   className={`flex items-start gap-3 rounded-lg border px-3 py-2 ${
                     c.passed ? 'border-ink-700/60 bg-ink-900/40' : 'border-bad/40 bg-bad/[0.08]'}`}>
                <span className={`mt-0.5 text-[12px] font-bold ${c.passed ? 'text-good' : 'text-bad'}`}>
                  {c.passed ? '✓' : '✕'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="text-[12px] font-medium text-ink-100">{c.label}</span>
                    <span className="text-[11px] tnum text-ink-300">
                      <span className={c.passed ? '' : 'font-semibold text-bad'}>{c.observed}</span>
                      <span className="text-ink-500"> · policy {c.limit}</span>
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] leading-relaxed text-ink-400">{c.detail}</div>
                </div>
              </div>
            ))}
          </div>

          {veto && decision.remediation && (
            <div className="mt-3 rounded-lg border border-ink-700 bg-ink-900/60 px-3.5 py-2.5">
              <div className="label">Constraints handed back to the Offer Agent</div>
              <div className="mt-1.5 text-[11.5px] leading-relaxed text-ink-200">{decision.remediation.note}</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {decision.remediation.minPricePaise != null &&
                  <Chip tone="warn">min price {inr(decision.remediation.minPricePaise, true)}</Chip>}
                {decision.remediation.maxExposurePaise != null &&
                  <Chip tone="warn">max subsidy {inr(decision.remediation.maxExposurePaise)}</Chip>}
                {decision.remediation.excludePrices?.length > 0 &&
                  <Chip tone="warn">excluded {decision.remediation.excludePrices.map((p: number) => inr(p)).join(', ')}</Chip>}
              </div>
              <p className="mt-2 text-[10.5px] leading-relaxed text-ink-500">
                The Risk Agent returns a feasible set, never a price. The Offer Agent re-optimises inside it —
                the two agents never share a decision function.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[11px] text-ink-400">{k}</span>
      <span className="text-[12px] font-medium tnum text-ink-100">{v}</span>
    </div>
  );
}
const Th = ({ children }: { children: React.ReactNode }) =>
  <th className="whitespace-nowrap px-2 py-1.5 font-medium uppercase tracking-wider text-[9.5px]">{children}</th>;
const Td = ({ children, className = '' }: { children: React.ReactNode; className?: string }) =>
  <td className={`whitespace-nowrap px-2 py-1.5 text-ink-200 ${className}`}>{children}</td>;
