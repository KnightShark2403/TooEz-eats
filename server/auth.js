import jwt from "jsonwebtoken";

// Dev-only fallback secret — fine for this local, no-external-services demo.
// Set JWT_SECRET in the environment for anything beyond that.
const JWT_SECRET = process.env.JWT_SECRET || "tooez-eats-dev-secret";

export function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name, email: user.email },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
}

// requireAuth("student") / requireAuth("staff") — verifies the bearer token
// and rejects if the account's role doesn't match what the route requires.
export function requireAuth(role) {
  return (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (role && payload.role !== role) {
        return res.status(403).json({ error: `This action requires a ${role} account` });
      }
      req.user = payload;
      next();
    } catch {
      return res.status(401).json({ error: "Invalid or expired session" });
    }
  };
}
