import { useState } from "react";
import { api } from "../lib/api.js";
import { getUser, clearSession } from "../lib/auth.js";
import { usePolling } from "../lib/usePolling.js";
import KanbanBoard from "./KanbanBoard.jsx";

const POLL_MS = 3000;

const DATE_LABEL = new Date().toLocaleDateString([], {
  weekday: "long",
  month: "long",
  day: "numeric",
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardScreen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [advancingId, setAdvancingId] = useState(null);

  usePolling(
    () =>
      api
        .getAllOrders()
        .then((fetched) => {
          setOrders(fetched);
          setError(null);
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false)),
    POLL_MS,
    []
  );

  const handleAdvance = async (orderId, nextStatus) => {
    setAdvancingId(orderId);
    try {
      const updated = await api.updateOrderStatus(orderId, nextStatus);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    } catch (e) {
      setError(e.message);
    } finally {
      setAdvancingId(null);
    }
  };

  const activeCount = orders.filter((o) => o.status !== "Completed").length;
  const todayCount = orders.length;

  return (
    <div style={{ minHeight: "100vh", background: "var(--dash-bg)", display: "flex" }}>
      <aside
        style={{
          width: 220,
          flexShrink: 0,
          borderRight: "1px solid #1f1b17",
          padding: "24px 16px",
          color: "#c8c0b2",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: "var(--dash-accent)",
                color: "#1c1408",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
              }}
            >
              T
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#f2ede4" }}>TooEz Eats</div>
              <div className="eyebrow" style={{ color: "#8a8378" }}>
                Canteen Console
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 12,
              background: "var(--dash-sidebar-active)",
              color: "var(--dash-accent)",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            <span>📋</span>
            Orders
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, color: "#8a8378", marginBottom: 8 }}>
            {getUser()?.name}
          </div>
          <button
            onClick={() => {
              clearSession();
              window.location.reload();
            }}
            style={{
              width: "100%",
              background: "none",
              border: "1px solid #2a241d",
              borderRadius: 12,
              padding: "10px 12px",
              color: "#c8c0b2",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Log out
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: "28px 32px", minWidth: 0 }}>
        <p className="eyebrow" style={{ color: "#8a8378", margin: "0 0 6px" }}>
          {DATE_LABEL}
        </p>
        <h1 style={{ fontSize: 26, margin: "0 0 6px", color: "#f2ede4" }}>{greeting()}</h1>
        <p style={{ color: "#8a8378", margin: "0 0 24px", fontSize: 14 }}>
          {loading ? "Loading orders…" : `${activeCount} order${activeCount === 1 ? "" : "s"} in the queue right now.`}
        </p>

        <div style={{ display: "flex", gap: 16, marginBottom: 28 }}>
          <StatCard label="Orders today" value={todayCount} />
          <StatCard label="In queue" value={activeCount} />
        </div>

        {error && (
          <p style={{ color: "var(--status-new)", marginBottom: 16 }}>
            Couldn't reach the server: {error}
          </p>
        )}

        <div style={{ overflowX: "auto", paddingBottom: 8 }}>
          <KanbanBoard orders={orders} onAdvance={handleAdvance} advancingId={advancingId} />
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div
      style={{
        background: "var(--dash-card)",
        borderRadius: 16,
        padding: "16px 20px",
        minWidth: 140,
      }}
    >
      <div className="eyebrow" style={{ color: "#8a8378", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: "#f2ede4" }}>{value}</div>
    </div>
  );
}
