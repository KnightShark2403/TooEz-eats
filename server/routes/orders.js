import { Router } from "express";
import db, { STATUSES, CONVENIENCE_FEE_RUPEES } from "../db.js";
import { requireAuth } from "../auth.js";

const router = Router();

function serializeOrder(order) {
  const items = db
    .prepare("SELECT name, price_rupees, quantity FROM order_items WHERE order_id = ?")
    .all(order.id);
  return { ...order, items };
}

// GET /api/orders — staff only, every order in the queue
router.get("/", requireAuth("staff"), (req, res) => {
  const orders = db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();
  res.json(orders.map(serializeOrder));
});

// GET /api/orders/mine — student only, just the logged-in student's orders
router.get("/mine", requireAuth("student"), (req, res) => {
  const orders = db
    .prepare("SELECT * FROM orders WHERE student_id = ? ORDER BY created_at DESC")
    .all(req.user.id);
  res.json(orders.map(serializeOrder));
});

// POST /api/orders  { items: [{ menu_item_id, quantity }] } — student only,
// the order is attributed to whichever account the bearer token belongs to.
router.post("/", requireAuth("student"), (req, res) => {
  const { items } = req.body;

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

  const itemsTotal = resolvedItems.reduce(
    (sum, { menuItem, quantity }) => sum + menuItem.price_rupees * quantity,
    0
  );
  const total = itemsTotal + CONVENIENCE_FEE_RUPEES;

  const createOrder = db.transaction(() => {
    const { lastInsertRowid: orderId } = db
      .prepare(
        "INSERT INTO orders (student_id, student_name, status, total_rupees, convenience_fee_rupees) VALUES (?, ?, 'New', ?, ?)"
      )
      .run(req.user.id, req.user.name, total, CONVENIENCE_FEE_RUPEES);

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

// PATCH /api/orders/:id/status  { status } — staff only
router.patch("/:id/status", requireAuth("staff"), (req, res) => {
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
