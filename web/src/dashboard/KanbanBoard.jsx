import { STATUSES } from "../student/statuses.js";
import OrderCard from "./OrderCard.jsx";

export default function KanbanBoard({ orders, onAdvance, advancingId }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${STATUSES.length}, minmax(220px, 1fr))`,
        gap: 16,
        alignItems: "start",
      }}
    >
      {STATUSES.map((status) => {
        const columnOrders = orders.filter((o) => o.status === status);
        return (
          <div key={status} style={{ minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
                padding: "0 2px",
              }}
            >
              <span className="eyebrow" style={{ color: "#c8c0b2" }}>
                {status}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#8a8378",
                  background: "var(--dash-card)",
                  borderRadius: 999,
                  padding: "2px 8px",
                }}
              >
                {columnOrders.length}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {columnOrders.length === 0 && (
                <div
                  style={{
                    border: "1px dashed #2a2620",
                    borderRadius: 14,
                    padding: "20px 12px",
                    textAlign: "center",
                    fontSize: 12,
                    color: "#5c574d",
                  }}
                >
                  Empty
                </div>
              )}
              {columnOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onAdvance={onAdvance}
                  advancing={advancingId === order.id}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
