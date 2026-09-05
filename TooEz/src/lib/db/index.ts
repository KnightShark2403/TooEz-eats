import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { seed } from './seed';

let _db: Database.Database | null = null;

function dbPath() {
  // Vercel's deployed bundle is read-only; /tmp is writable but ephemeral.
  const defaultPath = process.env.VERCEL
    ? path.join('/tmp', 'tooez.db')
    : path.join(process.cwd(), 'data', 'tooez.db');
  const p = process.env.TOOEZ_DB_PATH || defaultPath;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  return p;
}

export function getDb(): Database.Database {
  if (_db) return _db;
  const db = new Database(dbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'db', 'schema.sql'), 'utf8'));
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM merchants').get() as { n: number };
  if (n === 0) seed(db);
  _db = db;
  return db;
}

export function resetDb(): Database.Database {
  const p = dbPath();
  if (_db) { _db.close(); _db = null; }
  for (const s of ['', '-wal', '-shm']) { try { fs.unlinkSync(p + s); } catch { /* absent */ } }
  return getDb();
}
