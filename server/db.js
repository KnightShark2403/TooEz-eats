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

export const CONVENIENCE_FEE_RUPEES = 10;

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

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL CHECK (role IN ('student', 'staff', 'manager')),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER REFERENCES users(id),
    student_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'New',
    total_rupees INTEGER NOT NULL,
    convenience_fee_rupees INTEGER NOT NULL DEFAULT ${CONVENIENCE_FEE_RUPEES},
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

// Migrations for DBs created before these columns existed.
try {
  db.exec(
    `ALTER TABLE orders ADD COLUMN convenience_fee_rupees INTEGER NOT NULL DEFAULT ${CONVENIENCE_FEE_RUPEES}`
  );
} catch {
  // column already present
}
try {
  db.exec(`ALTER TABLE orders ADD COLUMN student_id INTEGER REFERENCES users(id)`);
} catch {
  // column already present
}

// SQLite can't ALTER a CHECK constraint in place — if an existing dev DB still
// has the pre-manager-role users table, rebuild it (same data, new constraint).
const usersTableSql = db
  .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'")
  .get()?.sql;
if (usersTableSql && !usersTableSql.includes("'manager'")) {
  db.pragma("foreign_keys = OFF");
  db.exec(`
    ALTER TABLE users RENAME TO users_old;
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL CHECK (role IN ('student', 'staff', 'manager')),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO users SELECT * FROM users_old;
    DROP TABLE users_old;
  `);
  db.pragma("foreign_keys = ON");
}

// SQLite's RENAME TABLE rewrites *other* tables' foreign-key reference text
// to follow the rename — so the users-table rebuild above (which renames
// users -> users_old -> users) can leave unrelated tables' FKs pointing at a
// "_old" name if they were ever rebuilt the same way. order_items.order_id
// picked up "orders_old" from an earlier hand-repair of the orders table,
// which breaks every order INSERT ("no such table: main.orders_old").
// Rebuild it in place, detected via sqlite_master text rather than a flag.
const orderItemsTableSql = db
  .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'order_items'")
  .get()?.sql;
if (orderItemsTableSql && !orderItemsTableSql.includes("REFERENCES orders(id)")) {
  db.pragma("foreign_keys = OFF");
  db.exec(`
    ALTER TABLE order_items RENAME TO order_items_old;
    CREATE TABLE order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
      name TEXT NOT NULL,
      price_rupees INTEGER NOT NULL,
      quantity INTEGER NOT NULL
    );
    INSERT INTO order_items SELECT * FROM order_items_old;
    DROP TABLE order_items_old;
  `);
  db.pragma("foreign_keys = ON");
}

export default db;
