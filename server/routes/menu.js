import { Router } from "express";
import db from "../db.js";
import { requireAuth } from "../auth.js";

const router = Router();

// GET /api/menu — student-facing, available items only
router.get("/", (req, res) => {
  const items = db
    .prepare("SELECT * FROM menu_items WHERE available = 1 ORDER BY category, name")
    .all();
  res.json(items);
});

// GET /api/menu/all — manager only, every item including unavailable ones
router.get("/all", requireAuth("manager"), (req, res) => {
  const items = db.prepare("SELECT * FROM menu_items ORDER BY category, name").all();
  res.json(items);
});

// POST /api/menu — manager only, add a custom item
router.post("/", requireAuth("manager"), (req, res) => {
  const { name, price_rupees, category } = req.body;
  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "name is required" });
  }
  if (!Number.isInteger(price_rupees) || price_rupees < 0) {
    return res.status(400).json({ error: "price_rupees must be a non-negative integer" });
  }
  if (typeof category !== "string" || !category.trim()) {
    return res.status(400).json({ error: "category is required" });
  }

  const { lastInsertRowid: id } = db
    .prepare("INSERT INTO menu_items (name, price_rupees, category) VALUES (?, ?, ?)")
    .run(name.trim(), price_rupees, category.trim());
  res.status(201).json(db.prepare("SELECT * FROM menu_items WHERE id = ?").get(id));
});

// PATCH /api/menu/:id — manager only, toggle availability / edit fields
router.patch("/:id", requireAuth("manager"), (req, res) => {
  const existing = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Menu item not found" });

  const { name, price_rupees, category, available } = req.body;
  const next = {
    name: typeof name === "string" && name.trim() ? name.trim() : existing.name,
    price_rupees: Number.isInteger(price_rupees) ? price_rupees : existing.price_rupees,
    category: typeof category === "string" && category.trim() ? category.trim() : existing.category,
    available: typeof available === "boolean" ? (available ? 1 : 0) : existing.available,
  };

  db.prepare(
    "UPDATE menu_items SET name = ?, price_rupees = ?, category = ?, available = ? WHERE id = ?"
  ).run(next.name, next.price_rupees, next.category, next.available, req.params.id);

  res.json(db.prepare("SELECT * FROM menu_items WHERE id = ?").get(req.params.id));
});

// DELETE /api/menu/:id — manager only
router.delete("/:id", requireAuth("manager"), (req, res) => {
  const existing = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Menu item not found" });

  db.prepare("DELETE FROM menu_items WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

export default router;
