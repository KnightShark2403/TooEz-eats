/**
 * Environment configuration and validation.
 *
 * Every secret is read from the environment. Nothing here is ever sent to the
 * browser except `keyId`, which is Razorpay's *public* identifier and is
 * required by Checkout. `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET`
 * are referenced only inside server modules.
 */

export interface EnvReport {
  ok: boolean;
  gateway: 'razorpay' | 'mock';
  testMode: boolean;
  problems: string[];
  warnings: string[];
}

export function envReport(): EnvReport {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();

  const problems: string[] = [];
  const warnings: string[] = [];

  if (keyId && !keySecret) problems.push('RAZORPAY_KEY_ID is set but RAZORPAY_KEY_SECRET is missing.');
  if (keySecret && !keyId) problems.push('RAZORPAY_KEY_SECRET is set but RAZORPAY_KEY_ID is missing.');

  if (keyId && keyId.startsWith('rzp_live_')) {
    problems.push('RAZORPAY_KEY_ID is a LIVE key. TooEz is configured for test mode only — replace it with an rzp_test_ key.');
  }
  if (keyId && !keyId.startsWith('rzp_test_') && !keyId.startsWith('rzp_live_')) {
    warnings.push('RAZORPAY_KEY_ID does not look like a Razorpay key id (expected rzp_test_…).');
  }
  if (keyId && keySecret && !webhookSecret) {
    warnings.push('RAZORPAY_WEBHOOK_SECRET is not set — inbound webhooks will be rejected. Set it to the same value you configured in the Razorpay dashboard.');
  }
  if (webhookSecret && keySecret && webhookSecret === keySecret) {
    problems.push('RAZORPAY_WEBHOOK_SECRET must NOT be the same value as RAZORPAY_KEY_SECRET. They are different secrets: the API key secret authenticates API calls, the webhook secret signs inbound webhooks.');
  }
  if (!keyId && !keySecret) {
    warnings.push('No Razorpay credentials configured — running on the local mock gateway.');
  }

  const gateway = keyId && keySecret ? 'razorpay' : 'mock';
  return {
    ok: problems.length === 0,
    gateway,
    testMode: Boolean(keyId?.startsWith('rzp_test_')),
    problems,
    warnings,
  };
}

/** Public, browser-safe view of the gateway configuration. */
export function publicGatewayInfo() {
  const r = envReport();
  return {
    mode: r.gateway,
    testMode: r.testMode,
    keyId: process.env.RAZORPAY_KEY_ID ?? null,   // public identifier, safe in the browser
    webhookConfigured: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
    llm: Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY),
    problems: r.problems,
    warnings: r.warnings,
  };
}
