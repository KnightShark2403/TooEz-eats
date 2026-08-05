import { Router } from "express";
import db from "../db.js";
import { requireAuth } from "../auth.js";

const router = Router();

// GET /api/analytics — manager only. All computed directly from existing
// orders/order_items rows — no separate tracking/aggregation table.
router.get("/", requireAuth("manager"), (req, res) => {
  const orders = db.prepare("SELECT * FROM orders").all();

  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + o.total_rupees, 0);
  const averageOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

  const revenueByDay = db
    .prepare(
      `SELECT date(created_at) AS day, SUM(total_rupees) AS revenue
       FROM orders GROUP BY day ORDER BY day ASC`
    )
    .all();

  const topItems = db
    .prepare(
      `SELECT name, SUM(quantity) AS quantity
       FROM order_items GROUP BY name ORDER BY quantity DESC LIMIT 5`
    )
    .all();

  res.json({ totalOrders, totalRevenue, averageOrderValue, revenueByDay, topItems });
});

export default router;
