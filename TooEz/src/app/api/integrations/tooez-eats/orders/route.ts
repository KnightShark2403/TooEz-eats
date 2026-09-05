import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { MERCHANT_ID } from '@/lib/merchant';

export const dynamic = 'force-dynamic';

type IncomingOrder = {
  sourceOrderId?: number | string;
  studentName?: string;
  totalRupees?: number;
  createdAt?: string;
  items?: { name?: string; quantity?: number; priceRupees?: number }[];
};

export async function POST(req: Request) {
  const secret = process.env.TOOEZ_SYNC_SECRET;
  if (!secret || req.headers.get('x-tooez-sync-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as IncomingOrder;
  const totalRupees = Number(body.totalRupees);
  if (!body.sourceOrderId || !body.studentName || !Number.isInteger(totalRupees) || !body.items?.length) {
    return NextResponse.json({ error: 'sourceOrderId, studentName, totalRupees and items are required' }, { status: 400 });
  }

  const db = getDb();
  const externalRef = `tooez_eats:${body.sourceOrderId}`;
  const existing = db.prepare('SELECT id FROM orders WHERE customer_ref = ?').get(externalRef) as { id?: string } | undefined;
  if (existing?.id) return NextResponse.json({ id: existing.id, duplicate: true });

  const campaign = db.prepare(
    `SELECT c.id FROM campaigns c WHERE c.merchant_id = ? ORDER BY c.created_at DESC LIMIT 1`
  ).get(MERCHANT_ID) as { id?: string } | undefined;
  if (!campaign?.id) return NextResponse.json({ error: 'No dashboard campaign is available for imported orders' }, { status: 503 });

  const orderId = `ord_eats_${body.sourceOrderId}`;
  db.prepare(
    `INSERT INTO orders
      (id, campaign_id, merchant_id, idempotency_key, amount_paise, status, gateway, customer_ref, customer_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'CREATED', 'tooez_eats', ?, ?, COALESCE(?, datetime('now')), datetime('now'))`
  ).run(
    orderId,
    campaign.id,
    MERCHANT_ID,
    externalRef,
    totalRupees * 100,
    externalRef,
    body.studentName.slice(0, 80),
    body.createdAt || null,
  );

  return NextResponse.json({ id: orderId, synced: true }, { status: 201 });
}