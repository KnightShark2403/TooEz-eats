import { Router } from "express";
import db from "../db.js";

const router = Router();

// GET /api/menu
router.get("/", (req, res) => {
  const items = db
    .prepare("SELECT * FROM menu_items WHERE available = 1 ORDER BY category, name")
    .all();
  res.json(items);
});

export default router;
