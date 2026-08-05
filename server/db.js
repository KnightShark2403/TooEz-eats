import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, "tooez.db"));

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export const STATUSES = [
  "New",
  "Accepted",
  "Preparing",
  "Ready for Pickup",
  "Completed",
];

db.exec(`
  CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price_rupees INTEGER NOT NULL,
    category TEXT NOT NULL DEFAULT 'Mains',
    image_url TEXT NOT NULL DEFAULT '',
    available INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'New',
    total_rupees INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
    name TEXT NOT NULL,
    price_rupees INTEGER NOT NULL,
    quantity INTEGER NOT NULL
  );
`);

export default db;
