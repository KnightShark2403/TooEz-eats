import { getDb } from './db';
import { bus } from './events';

export type Actor =
  | 'DETECTION_AGENT' | 'OFFER_AGENT' | 'RISK_AGENT' | 'SETTLEMENT_AGENT'
  | 'MERCHANT' | 'RAZORPAY' | 'CUSTOMER' | 'SYSTEM';

export type Severity = 'info' | 'success' | 'warn' | 'veto' | 'error';

export interface AuditInput {
  merchantId: string;
  actor: Actor;
  action: string;
  summary: string;
  severity?: Severity;
  detail?: unknown;
  opportunityId?: string;
  campaignId?: string;
  orderId?: string;
}

export function audit(a: AuditInput) {
  const db = getDb();
  const info = db.prepare(
    `INSERT INTO audit_log (merchant_id,actor,action,severity,summary,detail_json,opportunity_id,campaign_id,order_id)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(
    a.merchantId, a.actor, a.action, a.severity ?? 'info', a.summary,
    a.detail === undefined ? null : JSON.stringify(a.detail),
    a.opportunityId ?? null, a.campaignId ?? null, a.orderId ?? null
  );
  const row = db.prepare('SELECT * FROM audit_log WHERE id = ?').get(info.lastInsertRowid);
  bus.emit('audit', row);
  return row;
}

export function recentAudit(merchantId: string, limit = 80) {
  return getDb()
    .prepare('SELECT * FROM audit_log WHERE merchant_id = ? ORDER BY id DESC LIMIT ?')
    .all(merchantId, limit);
}

export function auditForOpportunity(opportunityId: string) {
  return getDb()
    .prepare('SELECT * FROM audit_log WHERE opportunity_id = ? ORDER BY id ASC')
    .all(opportunityId);
}
