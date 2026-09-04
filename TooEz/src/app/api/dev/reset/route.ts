import { NextResponse } from 'next/server';
import { resetDb } from '@/lib/db';
import { publishRefresh } from '@/lib/events';

export const dynamic = 'force-dynamic';

/** Rebuilds the demo dataset. Handy between rehearsal runs. */
export async function POST() {
  resetDb();
  publishRefresh('reset');
  return NextResponse.json({ ok: true });
}
