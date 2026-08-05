import { Router } from "express";
import db, { STATUSES } from "../db.js";

const router = Router();

function serializeOrder(order) {
  const items = db
    .prepare("SELECT name, price_rupees, quantity FROM order_items WHERE order_id = ?")
    .all(order.id);
  return { ...order, items };
}

// GET /api/orders?student_name=Alice
router.get("/", (req, res) => {
  const { student_name } = req.query;
  const orders = student_name
    ? db
        .prepare("SELECT * FROM orders WHERE student_name = ? ORDER BY created_at DESC")
        .all(student_name)
    : db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();

  res.json(orders.map(serializeOrder));
});

// POST /api/orders  { student_name, items: [{ menu_item_id, quantity }] }
router.post("/", (req, res) => {
  const { student_name, items } = req.body;

  if (!student_name || typeof student_name !== "string" || !student_name.trim()) {
    return res.status(400).json({ error: "student_name is required" });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items must be a non-empty array" });
  }

  const menuStmt = db.prepare("SELECT * FROM menu_items WHERE id = ? AND available = 1");
  const resolvedItems = [];
  for (const { menu_item_id, quantity } of items) {
    const menuItem = menuStmt.get(menu_item_id);
    if (!menuItem) {
      return res.status(400).json({ error: `Menu item ${menu_item_id} not found` });
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ error: `Invalid quantity for menu item ${menu_item_id}` });
    }
    resolvedItems.push({ menuItem, quantity });
  }

  const total = resolvedItems.reduce(
    (sum, { menuItem, quantity }) => sum + menuItem.price_rupees * quantity,
    0
  );

  const createOrder = db.transaction(() => {
    const { lastInsertRowid: orderId } = db
      .prepare(
        "INSERT INTO orders (student_name, status, total_rupees) VALUES (?, 'New', ?)"
      )
      .run(student_name.trim(), total);

    const insertItem = db.prepare(
      "INSERT INTO order_items (order_id, menu_item_id, name, price_rupees, quantity) VALUES (?, ?, ?, ?, ?)"
    );
    for (const { menuItem, quantity } of resolvedItems) {
      insertItem.run(orderId, menuItem.id, menuItem.name, menuItem.price_rupees, quantity);
    }

    return orderId;
  });

  const orderId = createOrder();
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  res.status(201).json(serializeOrder(order));
});

// PATCH /api/orders/:id/status  { status }
router.patch("/:id/status", (req, res) => {
  const { status } = req.body;
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${STATUSES.join(", ")}` });
  }

  const existing = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: "Order not found" });
  }

  db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(
    status,
    req.params.id
  );

  const updated = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  res.json(serializeOrder(updated));
});

export default router;
