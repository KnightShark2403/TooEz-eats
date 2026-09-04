import { NextResponse } from 'next/server';
import { envReport } from '@/lib/env';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Configuration self-check. Reports problems by name, never by value. */
export async function GET() {
  let dbOk = true; let dbError: string | null = null;
  try { getDb().prepare('SELECT 1').get(); } catch (e: any) { dbOk = false; dbError = e.message; }
  const r = envReport();
  return NextResponse.json({
    ok: r.ok && dbOk,
    database: { ok: dbOk, error: dbError },
    razorpay: {
      gateway: r.gateway,
      testMode: r.testMode,
      keyIdConfigured: Boolean(process.env.RAZORPAY_KEY_ID),
      keySecretConfigured: Boolean(process.env.RAZORPAY_KEY_SECRET),
      webhookSecretConfigured: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
      problems: r.problems,
      warnings: r.warnings,
    },
  }, { status: r.ok && dbOk ? 200 : 503 });
}
