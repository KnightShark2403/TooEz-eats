/**
 * Optional LLM narration layer.
 *
 * Scope, deliberately narrow: the LLM NEVER computes a price, a margin, a
 * forecast or a risk verdict. Every number in the system is produced by
 * deterministic code and passed to the model as facts. The model's only job is
 * to turn those facts into a sentence a merchant can read.
 *
 * If no API key is configured the deterministic sentence is used verbatim and
 * the row is tagged `reasoning_source = 'deterministic'`. Nothing is faked and
 * nothing degrades — the product works identically without an LLM.
 */

export interface Narration { text: string; source: 'deterministic' | 'llm' }

const SYSTEM = `You are the narration layer of a merchant revenue system.
You will be given a JSON object of facts that were computed by deterministic code.
Write 2-3 short sentences explaining the decision to a small-business owner.
Rules: use ONLY the numbers present in the facts; never invent, round or recompute a figure;
no bullet points; no preamble; plain professional English; under 70 words.`;

export function llmEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
}

export async function narrate(
  kind: 'offer' | 'detection' | 'risk',
  facts: Record<string, unknown>,
  fallback: string
): Promise<Narration> {
  if (!llmEnabled()) return { text: fallback, source: 'deterministic' };
  try {
    const text = process.env.ANTHROPIC_API_KEY
      ? await anthropic(kind, facts)
      : await openai(kind, facts);
    const t = (text || '').trim();
    return t ? { text: t, source: 'llm' } : { text: fallback, source: 'deterministic' };
  } catch {
    // An LLM outage must never break a revenue decision.
    return { text: fallback, source: 'deterministic' };
  }
}

async function anthropic(kind: string, facts: Record<string, unknown>) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest',
      max_tokens: 220,
      system: SYSTEM,
      messages: [{ role: 'user', content: `Decision type: ${kind}\nFacts:\n${JSON.stringify(facts, null, 2)}` }],
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`anthropic ${r.status}`);
  const j = await r.json();
  return j?.content?.[0]?.text as string;
}

async function openai(kind: string, facts: Record<string, unknown>) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      max_tokens: 220,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `Decision type: ${kind}\nFacts:\n${JSON.stringify(facts, null, 2)}` },
      ],
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`openai ${r.status}`);
  const j = await r.json();
  return j?.choices?.[0]?.message?.content as string;
}
