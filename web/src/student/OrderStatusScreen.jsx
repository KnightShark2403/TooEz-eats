import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { getStudentName } from "../lib/student.js";
import { usePolling } from "../lib/usePolling.js";
import { STATUSES } from "./statuses.js";
import BottomTabBar from "./BottomTabBar.jsx";
import EmptyState from "./EmptyState.jsx";

const POLL_MS = 3000;

export default function OrderStatusScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);

  usePolling(
    () => {
      const name = getStudentName();
      if (!name) return Promise.resolve();
      return api
        .getOrders(name)
        .then((orders) => {
          const found = orders.find((o) => String(o.id) === id);
          if (!found) return setError("Order not found");
          setOrder(found);
        })
        .catch((e) => setError(e.message));
    },
    POLL_MS,
    [id]
  );

  if (error) {
    return (
      <EmptyState
        icon="⚠️"
        message={error}
        ctaLabel="Back to menu"
        onCta={() => navigate("/")}
      />
    );
  }
  if (!order) {
    return <EmptyState icon="⏳" message="Loading order…" />;
  }

  const currentIndex = STATUSES.indexOf(order.status);
  const placedAt = new Date(order.created_at.replace(" ", "T") + "Z").toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--mobile-bg)",
        maxWidth: 480,
        margin: "0 auto",
        padding: "28px 20px 110px",
      }}
    >
      <button
        onClick={() => navigate("/")}
        style={{
          background: "none",
          border: "none",
          color: "#8a857a",
          fontSize: 14,
          cursor: "pointer",
          padding: 0,
          marginBottom: 16,
        }}
      >
        ← Menu
      </button>

      <div
        style={{
          background: "var(--mobile-hero)",
          borderRadius: 20,
          padding: 22,
          color: "#fff",
          marginBottom: 20,
        }}
      >
        <p className="eyebrow" style={{ color: "var(--mobile-accent)", margin: "0 0 8px" }}>
          Order #{order.id}
        </p>
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>{order.status}</div>
        <div style={{ fontSize: 13, opacity: 0.75 }}>
          Placed at {placedAt} · ₹{order.total_rupees}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          background: "#fff",
          borderRadius: 18,
          padding: "18px 12px",
          marginBottom: 20,
        }}
      >
        {STATUSES.map((s, i) => (
          <div
            key={s}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              flex: 1,
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: i <= currentIndex ? "var(--mobile-accent)" : "#eee6d8",
                color: i <= currentIndex ? "#1c1c1a" : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {i <= currentIndex ? "✓" : ""}
            </div>
            <span
              style={{
                fontSize: 9,
                textAlign: "center",
                color: i <= currentIndex ? "#1c1c1a" : "#b3ada0",
                fontWeight: i === currentIndex ? 700 : 500,
              }}
            >
              {s}
            </span>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", borderRadius: 18, padding: 18 }}>
        <p className="eyebrow" style={{ color: "var(--mobile-hero)", margin: "0 0 10px" }}>
          Items
        </p>
        {order.items.map((item, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 14,
              padding: "6px 0",
              color: "#4a463f",
            }}
          >
            <span>
              {item.quantity} × {item.name}
            </span>
            <span>₹{item.price_rupees * item.quantity}</span>
          </div>
        ))}
      </div>

      <BottomTabBar activeOrder={order.status !== "Completed" ? order : null} activeKey={order.status} />
    </div>
  );
}
