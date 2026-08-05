import express from "express";
import cors from "cors";
import menuRoutes from "./routes/menu.js";
import orderRoutes from "./routes/orders.js";
import authRoutes from "./routes/auth.js";
import analyticsRoutes from "./routes/analytics.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/analytics", analyticsRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`TooEz Eats server listening on http://localhost:${PORT}`);
});
