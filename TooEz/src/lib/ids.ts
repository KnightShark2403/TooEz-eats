import crypto from 'node:crypto';

export function id(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(9).toString('base64url')}`;
}

export function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}
