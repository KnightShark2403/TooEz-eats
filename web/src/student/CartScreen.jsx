import { useNavigate } from "react-router-dom";
import { useCart } from "../state/CartContext.jsx";
import { visualForItem } from "../lib/menuVisuals.js";
import EmptyState from "./EmptyState.jsx";

export default function CartScreen() {
  const navigate = useNavigate();
  const { items, setQuantity, totalRupees, totalCount } = useCart();

  if (items.length === 0) {
    return (
      <EmptyState
        icon="🛒"
        message="Your cart is empty — add something from the menu."
        ctaLabel="Browse menu"
        onCta={() => navigate("/")}
      />
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--mobile-bg)",
        maxWidth: 480,
        margin: "0 auto",
        padding: "28px 20px 140px",
      }}
    >
      <button
        onClick={() => navigate(-1)}
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
        ← Back to menu
      </button>
      <h1 style={{ fontSize: 24, margin: "0 0 20px", color: "#1c1c1a" }}>Your order</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map(({ menuItem, quantity }) => {
          const visual = visualForItem(menuItem.id);
          return (
            <div
              key={menuItem.id}
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
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: visual.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  flexShrink: 0,
                }}
              >
                {visual.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#1c1c1a" }}>
                  {menuItem.name}
                </div>
                <div style={{ fontSize: 13, color: "#8a857a" }}>
                  ₹{menuItem.price_rupees} each
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  onClick={() => setQuantity(menuItem.id, quantity - 1)}
                  style={stepperBtnStyle}
                >
                  −
                </button>
                <span style={{ fontWeight: 700, minWidth: 16, textAlign: "center" }}>
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(menuItem.id, quantity + 1)}
                  style={stepperBtnStyle}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {items.length > 0 && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: 24,
            width: "calc(100% - 40px)",
            maxWidth: 440,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "0 4px 10px",
              fontSize: 14,
              color: "#4a463f",
            }}
          >
            <span>
              {totalCount} item{totalCount === 1 ? "" : "s"}
            </span>
            <span style={{ fontWeight: 700 }}>₹{totalRupees}</span>
          </div>
          <button
            onClick={() => navigate("/checkout")}
            style={{
              width: "100%",
              background: "var(--mobile-dark-ui)",
              color: "#fff",
              border: "none",
              borderRadius: 16,
              padding: "16px 18px",
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Proceed to payment
          </button>
        </div>
      )}
    </div>
  );
}

const stepperBtnStyle = {
  width: 28,
  height: 28,
  borderRadius: "50%",
  border: "1px solid #e4ddd0",
  background: "#fff",
  fontSize: 16,
  lineHeight: 1,
  cursor: "pointer",
};
