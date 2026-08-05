import { timeAgo } from "../lib/timeAgo.js";
import { STATUSES } from "../student/statuses.js";

export default function OrderCard({ order, onAdvance, advancing }) {
  const currentIndex = STATUSES.indexOf(order.status);
  const nextStatus = STATUSES[currentIndex + 1];

  return (
    <div
      style={{
        background: "var(--dash-ticket)",
        borderRadius: 14,
        padding: "14px 14px 16px",
        color: "#2b2620",
        borderBottom: "3px dashed rgba(43,38,32,0.15)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <span
          className="eyebrow"
          style={{ color: "rgba(43,38,32,0.55)" }}
        >
          #{String(order.id).padStart(4, "0")}
        </span>
        <span className="eyebrow" style={{ color: "rgba(43,38,32,0.45)" }}>
          {timeAgo(order.created_at)}
        </span>
      </div>

      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
        {order.student_name}
      </div>

      <div style={{ fontSize: 13, marginBottom: 10, lineHeight: 1.6 }}>
        {order.items.map((item, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{item.name}</span>
            <span style={{ opacity: 0.6 }}>x{item.quantity}</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.6 }}>
          <span>Convenience fee</span>
          <span>₹{order.convenience_fee_rupees}</span>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span className="status-pill" data-status={order.status}>
          {order.status}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.7 }}>
          ₹{order.total_rupees}
        </span>
      </div>

      {nextStatus && (
        <button
          onClick={() => onAdvance(order.id, nextStatus)}
          disabled={advancing}
          style={{
            width: "100%",
            marginTop: 12,
            padding: "8px 10px",
            borderRadius: 10,
            border: "none",
            background: "var(--dash-accent)",
            color: "#1c1408",
            fontWeight: 700,
            fontSize: 12,
            cursor: advancing ? "default" : "pointer",
            opacity: advancing ? 0.6 : 1,
          }}
        >
          Move to {nextStatus} →
        </button>
      )}
    </div>
  );
}
