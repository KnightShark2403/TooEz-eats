'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, SectionHead, Chip, Skeleton, EmptyState, ErrorState } from '@/components/ui/kit';
import { Icon } from '@/components/ui/icons';
import { inr, pct } from '@/components/ui/data';

/**
 * The Detect → Offer → Risk → Approve trail for one opportunity.
 * This is the product's explainability surface: every number shown here is
 * read back from the database rows the agents wrote.
 */
export function DecisionConsole({ opportunityId, onChanged, version }: {
  opportunityId: string | null; onChanged: () => void; version?: string | number;
}) {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    if (!opportunityId) { setD(null); return; }
    setLoading(true); setErr(null);
    try {
      const r = await fetch(`/api/opportunity/${opportunityId}`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Could not load this opportunity');
      setD(j);
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [opportunityId, version]);

  const act = async (url: string, body?: unknown) => {
    setBusy(url); setActionError(null);
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? 'The campaign action could not be completed');
      await load(); onChanged();
    } catch (e: any) {
      setActionError(e.message ?? 'The campaign action could not be completed');
    } finally { setBusy(null); }
  };

  if (!opportunityId) {
    return <Card><EmptyState title="No opportunity selected" icon={<Icon.Agent size={26} />}
      hint="Pick an opportunity on the left, then run the agents. The full Detection → Offer → Risk → Approval trail appears here." /></Card>;
  }
  if (err) return <Card><ErrorState message={err} onRetry={load} /></Card>;
  if (loading && !d) return <div className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-44" /></div>;
  if (!d) return null;

  const { opportunity: o, signals: s, rounds, campaign, ladder } = d;
  const vetoed = rounds.filter((r: any) => r.decision?.verdict === 'VETOED');
  const approved = rounds.find((r: any) => r.decision?.verdict === 'APPROVED');

  return (
    <div className="space-y-3">
      <Card className="card-pad">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              <span className="label !text-[color:var(--brand)]">Detection Agent</span>
            </div>
            <div className="mt-2 text-[20px] font-semibold tnum text-ink">
              {inr(o.value_at_risk_paise)} <span className="text-[13px] font-normal text-ink-3">recoverable</span>
            </div>
          </div>
          <Chip tone="neutral">deterministic forecast · no LLM</Chip>
        </div>
        <p className="mt-2.5 text-[12px] leading-relaxed text-ink-2">{o.rationale}</p>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 border-t border-line pt-3 sm:grid-cols-3">
          <KV k="Demand now" v={`${s.avgUnitsThisHour} u/hr`} />
          <KV k="Demand next hour" v={`${s.avgUnitsNextHour} u/hr`} />
          <KV k="Forecast audience" v={`${s.audienceEstimate} views`} />
          <KV k="Sells at list price" v={`${s.baselineUnits} of ${s.stockUnits} u`} />
          <KV k="Inventory at risk" v={inr(s.inventoryAtRiskPaise)} />
          <KV k="Shelf life left" v={s.minutesOfShelfLifeLeft != null ? `${s.minutesOfShelfLifeLeft} min` : '—'} />
        </div>
      </Card>

      {actionError && (
        <div role="alert" className="rounded-lg border border-bad-border bg-bad-soft px-4 py-2.5 text-[12px] text-bad">
          {actionError}
        </div>
      )}

      {rounds.length === 0
        ? <Card><EmptyState title="Agents have not run yet" hint="Press “Run agents” on the opportunity to start the Offer ⇄ Risk negotiation." /></Card>
        : rounds.map((r: any) => <Round key={r.offer.id} round={r} listPaise={o.list_price_paise} />)}

      {campaign && (
        <Card className={`card-pad ${campaign.status === 'PENDING_APPROVAL' ? 'border-warn-border' : ''}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="label">Merchant approval gate</div>
              <div className="mt-1.5 text-[13px] text-ink">
                {campaign.status === 'PENDING_APPROVAL'
                  ? <>Campaign drafted at <b className="tnum">{inr(campaign.price_paise)}</b> × {campaign.units_offered} units. Nothing is sellable until you approve.</>
                  : campaign.status === 'REJECTED' ? 'You rejected this campaign. No order can be created.'
                  : <>Campaign <b>{campaign.status.toLowerCase()}</b> — {campaign.units_sold}/{campaign.units_offered} units sold, {inr(campaign.revenue_paise)} booked.</>}
              </div>
            </div>
            <div className="flex gap-2">
              {campaign.status === 'PENDING_APPROVAL' && (
                <>
                  <button className="btn-bad" disabled={!!busy}
                    onClick={() => act(`/api/campaigns/${campaign.id}/reject`, { reason: 'Merchant declined' })}>Reject</button>
                  <button className="btn-good" disabled={!!busy}
                    onClick={() => act(`/api/campaigns/${campaign.id}/approve`)}>
                    <Icon.Check /> {busy ? 'Approving…' : 'Approve campaign'}
                  </button>
                </>
              )}
              {(campaign.status === 'LIVE' || campaign.status === 'COMPLETED') && (
                <Link className="btn-primary" href={`/shop/${campaign.id}`} target="_blank">
                  <Icon.External /> Open customer checkout
                </Link>
              )}
            </div>
          </div>
          {campaign.status === 'LIVE' && (
            <div className="mt-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-[11.5px] text-ink-2">
              Share <code className="rounded bg-surface-sunk px-1.5 py-0.5 font-mono text-ink">/shop/{campaign.id}</code> — the only
              surface where a Razorpay order can be created for this offer.
            </div>
          )}
        </Card>
      )}

      {ladder?.length > 0 && (
        <Card className="card-pad">
          <SectionHead title="Price ladder the Offer Agent optimised over" right={<Chip tone="sand">learning loop</Chip>} />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-line">
                <th className="th">Price</th><th className="th">Discount</th><th className="th">Conv. rate</th>
                <th className="th">Evidence</th><th className="th text-right">Exp. units</th>
                <th className="th text-right">Exp. revenue</th><th className="th text-right">Margin</th>
              </tr></thead>
              <tbody>
                {ladder.map((p: any) => {
                  const chosen = approved && p.price_paise === approved.offer.offer_price_paise;
                  const wasVetoed = vetoed.some((v: any) => v.offer.offer_price_paise === p.price_paise);
                  return (
                    <tr key={p.price_paise}
                      className={`border-b border-line last:border-0 ${chosen ? 'bg-good-soft' : wasVetoed ? 'bg-bad-soft' : ''}`}>
                      <td className="td font-medium text-ink">
                        {inr(p.price_paise)}
                        {chosen && <span className="ml-1.5 text-good">✓</span>}
                        {wasVetoed && <span className="ml-1.5 text-bad">✕</span>}
                      </td>
                      <td className="td tnum">{pct(p.discount_pct)}</td>
                      <td className="td tnum">{pct(p.conversion_rate * 100)}</td>
                      <td className="td text-ink-4">
                        {p.observed_impressions > 0 ? `${p.observed_conversions}/${p.observed_impressions} observed` : 'prior only'}
                      </td>
                      <td className="td text-right tnum">{p.expected_conversions.toFixed(1)}</td>
                      <td className="td text-right tnum text-ink">{inr(p.expected_revenue_paise)}</td>
                      <td className={`td text-right tnum ${p.margin_pct < 22 ? 'text-bad' : ''}`}>{pct(p.margin_pct)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2.5 text-[11px] leading-relaxed text-ink-4">
            Conversion blends observed outcomes from past campaigns with a logistic elasticity prior (Bayesian shrinkage).
            Rows marked “observed” carry real conversion data — that is the learning loop changing today&apos;s recommendation.
          </p>
        </Card>
      )}
    </div>
  );
}

function Round({ round, listPaise }: { round: any; listPaise: number }) {
  const { offer, decision } = round;
  const veto = decision?.verdict === 'VETOED';
  return (
    <div className="space-y-2">
      <Card className="card-pad">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-sand" />
              <span className="label !text-[color:var(--sand)]">Offer Agent · attempt {offer.attempt}</span>
              <Chip tone="neutral">{offer.strategy.replace('_', ' ').toLowerCase()}</Chip>
              {offer.reasoning_source === 'llm' && <Chip tone="brand">LLM narration</Chip>}
            </div>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[24px] font-semibold leading-none tnum text-ink">{inr(offer.offer_price_paise)}</span>
              <span className="text-[12px] tnum text-ink-4 line-through">{inr(listPaise)}</span>
              <Chip tone="neutral">{pct(offer.discount_pct)} off</Chip>
              <Chip tone={offer.margin_pct < 0 ? 'bad' : 'neutral'}>{pct(offer.margin_pct)} margin</Chip>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="label">Expected</div>
            <div className="mt-1 text-[15px] font-semibold tnum text-ink">{inr(offer.expected_revenue_paise)}</div>
            <div className="text-[11px] tnum text-ink-3">{Number(offer.expected_conversions).toFixed(1)} conversions</div>
          </div>
        </div>
        <p className="mt-2.5 border-t border-line pt-2.5 text-[12px] leading-relaxed text-ink-2">{offer.reasoning}</p>
      </Card>

      {decision && (
        <Card className={`card-pad ${veto ? 'veto-pulse border-bad-border bg-bad-soft' : 'border-good-border'}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${veto ? 'bg-bad' : 'bg-good'}`} />
              <span className={`label ${veto ? '!text-[color:var(--bad)]' : '!text-[color:var(--good)]'}`}>Independent Risk Agent</span>
            </div>
            <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-semibold ${
              veto ? 'bg-bad-soft text-bad' : 'bg-good-soft text-good'}`}>
              {veto ? '✕  VETOED' : '✓  APPROVED'}
            </div>
          </div>

          {veto && (
            <div className="mt-3 rounded-lg border border-bad-border bg-bad-soft px-3.5 py-2.5">
              <div className="text-[12.5px] font-medium text-bad">
                Offer blocked before any financial action. No campaign was created, so no Razorpay order can exist for this price.
              </div>
              <div className="mt-1 text-[11.5px] text-ink-2">{decision.primary_reason}</div>
            </div>
          )}

          <div className="mt-3 space-y-1">
            {decision.checks.map((c: any) => (
              <div key={c.rule} className={`flex items-start gap-3 rounded-lg border px-3 py-2 ${
                c.passed ? 'border-line bg-surface-2' : 'border-bad-border bg-bad-soft'}`}>
                <span className={`mt-0.5 text-[12px] font-bold ${c.passed ? 'text-good' : 'text-bad'}`}>{c.passed ? '✓' : '✕'}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="text-[12px] font-medium text-ink">{c.label}</span>
                    <span className="text-[11px] tnum text-ink-3">
                      <span className={c.passed ? '' : 'font-semibold text-bad'}>{c.observed}</span>
                      <span className="text-ink-4"> · policy {c.limit}</span>
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] leading-relaxed text-ink-4">{c.detail}</div>
                </div>
              </div>
            ))}
          </div>

          {veto && decision.remediation && (
            <div className="mt-3 rounded-lg border border-line bg-surface-2 px-3.5 py-2.5">
              <div className="label">Constraints handed back to the Offer Agent</div>
              <div className="mt-1.5 text-[11.5px] leading-relaxed text-ink-2">{decision.remediation.note}</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {decision.remediation.minPricePaise != null && <Chip tone="warn">min price {inr(decision.remediation.minPricePaise, true)}</Chip>}
                {decision.remediation.maxExposurePaise != null && <Chip tone="warn">max subsidy {inr(decision.remediation.maxExposurePaise)}</Chip>}
                {decision.remediation.excludePrices?.length > 0 && <Chip tone="warn">excluded {decision.remediation.excludePrices.map((p: number) => inr(p)).join(', ')}</Chip>}
              </div>
              <p className="mt-2 text-[10.5px] leading-relaxed text-ink-4">
                The Risk Agent returns a feasible set, never a price. The Offer Agent re-optimises inside it —
                the two agents never share a decision function.
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[11px] text-ink-3">{k}</span>
      <span className="text-[12px] font-medium tnum text-ink">{v}</span>
    </div>
  );
}
