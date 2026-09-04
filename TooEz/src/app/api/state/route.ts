import { NextResponse } from 'next/server';
import { dashboardState } from '@/lib/state';
import { MERCHANT_ID } from '@/lib/merchant';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(dashboardState(MERCHANT_ID), {
    headers: { 'cache-control': 'no-store' },
  });
}
