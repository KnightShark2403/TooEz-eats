import fs from 'node:fs';
import path from 'node:path';

const p = process.env.TOOEZ_DB_PATH || path.join(process.cwd(), 'data', 'tooez.db');
let removed = 0;
for (const s of ['', '-wal', '-shm']) {
  try { fs.unlinkSync(p + s); removed++; } catch { /* absent */ }
}
console.log(removed ? `Removed ${removed} database file(s). It will be re-seeded on the next request.`
                    : 'No database file found — it will be created on the next request.');
