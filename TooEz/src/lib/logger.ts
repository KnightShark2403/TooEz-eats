/**
 * Minimal structured server logger with mandatory secret redaction.
 *
 * Never log: RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, signatures, card or
 * VPA details, or full webhook payloads. Razorpay ids (order_…, pay_…, rfnd_…)
 * are safe and are what you actually need when debugging.
 */

const SECRET_KEYS = new Set([
  'key_secret', 'keysecret', 'razorpay_key_secret', 'webhook_secret', 'webhooksecret',
  'razorpay_webhook_secret', 'signature', 'razorpay_signature', 'x-razorpay-signature',
  'authorization', 'password', 'token', 'apikey', 'api_key', 'secret',
  'card', 'vpa', 'email', 'contact',
]);

function secretValues(): string[] {
  return [
    process.env.RAZORPAY_KEY_SECRET,
    process.env.RAZORPAY_WEBHOOK_SECRET,
    process.env.ANTHROPIC_API_KEY,
    process.env.OPENAI_API_KEY,
  ].filter((v): v is string => Boolean(v && v.length >= 8));
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[deep]';
  if (value == null) return value;
  if (typeof value === 'string') {
    let out = value;
    for (const s of secretValues()) if (out.includes(s)) out = out.split(s).join('[REDACTED]');
    return out;
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SECRET_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : redact(v, depth + 1);
  }
  return out;
}

type Level = 'info' | 'warn' | 'error';

function emit(level: Level, scope: string, message: string, meta?: unknown) {
  const line = `[tooez:${scope}] ${message}`;
  const payload = meta === undefined ? '' : ' ' + safeJson(redact(meta));
  if (level === 'error') console.error(line + payload);
  else if (level === 'warn') console.warn(line + payload);
  else console.log(line + payload);
}

function safeJson(v: unknown) {
  try { return JSON.stringify(v); } catch { return '[unserialisable]'; }
}

export const log = {
  info: (scope: string, message: string, meta?: unknown) => emit('info', scope, message, meta),
  warn: (scope: string, message: string, meta?: unknown) => emit('warn', scope, message, meta),
  error: (scope: string, message: string, meta?: unknown) => emit('error', scope, message, meta),
};
