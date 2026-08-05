import { Router } from "express";
import bcrypt from "bcryptjs";
import db from "../db.js";
import { signToken } from "../auth.js";

const router = Router();

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

// POST /api/auth/signup  { role, email, password, name }
router.post("/signup", async (req, res) => {
  const { role, password } = req.body;
  const email = normalizeEmail(req.body.email);
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";

  if (!["student", "staff", "manager"].includes(role)) {
    return res.status(400).json({ error: "role must be student, staff, or manager" });
  }
  if (!email) return res.status(400).json({ error: "Email is required" });
  if (!name) return res.status(400).json({ error: "Name is required" });
  if (!password || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const { lastInsertRowid: id } = db
    .prepare("INSERT INTO users (role, email, password_hash, name) VALUES (?, ?, ?, ?)")
    .run(role, email, passwordHash, name);

  const user = { id, role, email, name };
  res.status(201).json({ token: signToken(user), user });
});

// POST /api/auth/login  { role, email, password }
router.post("/login", async (req, res) => {
  const { role, password } = req.body;
  const email = normalizeEmail(req.body.email);

  if (!["student", "staff", "manager"].includes(role)) {
    return res.status(400).json({ error: "role must be student, staff, or manager" });
  }
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!row || row.role !== role) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const user = { id: row.id, role: row.role, email: row.email, name: row.name };
  res.json({ token: signToken(user), user });
});

export default router;
