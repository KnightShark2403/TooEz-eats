import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { getStudentName } from "../lib/student.js";
import { useActiveOrders } from "../lib/useActiveOrders.js";
import { visualForItem } from "../lib/menuVisuals.js";
import { useCart } from "../state/CartContext.jsx";
import BottomTabBar from "./BottomTabBar.jsx";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function MenuScreen() {
  const navigate = useNavigate();
  const { addItem, totalCount, totalRupees } = useCart();
  const { activeOrders } = useActiveOrders();
  const primaryActiveOrder = activeOrders[0] || null;
  const [menu, setMenu] = useState([]);
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const name = getStudentName();

  useEffect(() => {
    api
      .getMenu()
      .then(setMenu)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(
    () => ["All", ...new Set(menu.map((m) => m.category))],
    [menu]
  );
  const visibleItems = useMemo(
    () => (category === "All" ? menu : menu.filter((m) => m.category === category)),
    [menu, category]
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--mobile-bg)",
        maxWidth: 480,
        margin: "0 auto",
        paddingBottom: totalCount > 0 ? 150 : 90,
      }}
    >
      <div style={{ padding: "28px 20px 0" }}>
        <p className="eyebrow" style={{ color: "var(--mobile-hero)", margin: "0 0 6px" }}>
          NHCE Canteen
        </p>
        <h1 style={{ fontSize: 26, margin: "0 0 20px", color: "#1c1c1a" }}>
          {greeting()}, <span style={{ color: "var(--mobile-accent)" }}>{name}</span>
        </h1>
      </div>

      {activeOrders.length > 0 && (
        <div
          style={{
            padding: "0 20px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {activeOrders.map((order) => (
            <button
              key={order.id}
              onClick={() => navigate(`/order/${order.id}`)}
              style={{
                width: "100%",
                textAlign: "left",
                background: "var(--mobile-hero)",
                borderRadius: 20,
                padding: 20,
                border: "none",
                cursor: "pointer",
                color: "#fff",
              }}
            >
              <p
                className="eyebrow"
                style={{ color: "var(--mobile-accent)", margin: "0 0 6px" }}
              >
                Live Order
              </p>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
                {order.status}
              </div>
              <div style={{ fontSize: 13, opacity: 0.75 }}>
                Order #{order.id} · {order.items.length} item
                {order.items.length === 1 ? "" : "s"} · ₹{order.total_rupees}
              </div>
            </button>
          ))}
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "0 20px 16px",
          overflowX: "auto",
        }}
      >
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            style={{
              flexShrink: 0,
              padding: "8px 16px",
              borderRadius: 999,
              border: c === category ? "none" : "1px solid #e4ddd0",
              background: c === category ? "var(--mobile-dark-ui)" : "#fff",
              color: c === category ? "#fff" : "#4a463f",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {c}
          </button>
        ))}
      </div>

      <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        {loading && <p style={{ color: "#8a857a" }}>Loading menu…</p>}
        {error && <p style={{ color: "var(--status-new)" }}>Couldn't load menu: {error}</p>}
        {!loading && !error && visibleItems.length === 0 && (
          <p style={{ color: "#8a857a" }}>Nothing here yet — check back soon.</p>
        )}
        {visibleItems.map((item) => {
          const visual = visualForItem(item.id);
          return (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                background: "#fff",
                borderRadius: 18,
                padding: 12,
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: visual.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  flexShrink: 0,
                }}
              >
                {visual.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#1c1c1a" }}>
                  {item.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#8a857a",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.description || item.category}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>
                  ₹{item.price_rupees}
                </div>
              </div>
              <button
                onClick={() => addItem(item)}
                aria-label={`Add ${item.name}`}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  border: "none",
                  background: "var(--mobile-dark-ui)",
                  color: "#fff",
                  fontSize: 18,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                +
              </button>
            </div>
          );
        })}
      </div>

      {totalCount > 0 && (
        <button
          onClick={() => navigate("/cart")}
          style={{
            position: "fixed",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: 76,
            width: "calc(100% - 40px)",
            maxWidth: 440,
            background: "var(--mobile-accent)",
            border: "none",
            borderRadius: 16,
            padding: "14px 18px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "#1c1c1a",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <span>
            {totalCount} item{totalCount === 1 ? "" : "s"} · ₹{totalRupees}
          </span>
          <span>View cart →</span>
        </button>
      )}

      <BottomTabBar activeOrder={primaryActiveOrder} activeKey="Home" />
    </div>
  );
}
