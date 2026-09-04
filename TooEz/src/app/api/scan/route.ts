import { NextResponse } from 'next/server';
import { detect } from '@/agents/detection';
import { MERCHANT_ID } from '@/lib/merchant';
import { publishRefresh } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const hour = typeof body.hour === 'number' ? body.hour : null;
  const windowMinutes = typeof body.windowMinutes === 'number' ? body.windowMinutes : 30;
  const result = detect(MERCHANT_ID, { hour, windowMinutes });
  publishRefresh('scan');
  return NextResponse.json(result);
}
