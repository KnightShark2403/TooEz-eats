import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../state/CartContext.jsx";
import { api } from "../lib/api.js";
import { getStudentName } from "../lib/student.js";
import { charge } from "../lib/paymentGateway.js";
import { CONVENIENCE_FEE_RUPEES } from "../lib/fees.js";
import EmptyState from "./EmptyState.jsx";

// STAGE: "idle" (reviewing) -> "processing" (stub gateway call) ->
// "success" (brief confirmation) -> order gets created and we navigate away.
export default function CheckoutScreen() {
  const navigate = useNavigate();
  const { items, totalRupees, totalCount, clear } = useCart();
  const [stage, setStage] = useState("idle");
  const [error, setError] = useState(null);
  const name = getStudentName();
  const payableRupees = totalRupees + CONVENIENCE_FEE_RUPEES;

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

  const payAndPlaceOrder = async () => {
    setStage("processing");
    setError(null);
    try {
      const payment = await charge({ amountRupees: payableRupees });
      if (!payment.success) throw new Error("Payment failed — please try again.");

      setStage("success");
      await new Promise((resolve) => setTimeout(resolve, 600));

      const order = await api.createOrder(
        items.map((i) => ({ menu_item_id: i.menuItem.id, quantity: i.quantity }))
      );
      clear();
      navigate(`/order/${order.id}`);
    } catch (e) {
      setError(e.message);
      setStage("idle");
    }
  };

  if (stage === "processing" || stage === "success") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--mobile-bg)",
          maxWidth: 480,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
          padding: 24,
        }}
      >
        {stage === "processing" ? (
          <>
            <div className="spinner" />
            <p style={{ color: "#4a463f", fontSize: 15, fontWeight: 600 }}>
              Processing payment…
            </p>
            <p style={{ color: "#8a857a", fontSize: 12 }}>₹{payableRupees} · stub gateway</p>
          </>
        ) : (
          <>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "var(--status-ready)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
              }}
            >
              ✓
            </div>
            <p style={{ color: "#1c1c1a", fontSize: 16, fontWeight: 700 }}>
              Payment successful
            </p>
          </>
        )}
      </div>
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
        ← Back to cart
      </button>
      <h1 style={{ fontSize: 24, margin: "0 0 20px", color: "#1c1c1a" }}>Review & pay</h1>

      <div style={{ background: "#fff", borderRadius: 18, padding: 18, marginBottom: 16 }}>
        <p className="eyebrow" style={{ color: "var(--mobile-hero)", margin: "0 0 10px" }}>
          Order summary
        </p>
        {items.map(({ menuItem, quantity }) => (
          <div
            key={menuItem.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 14,
              padding: "6px 0",
              color: "#4a463f",
            }}
          >
            <span>
              {quantity} × {menuItem.name}
            </span>
            <span>₹{menuItem.price_rupees * quantity}</span>
          </div>
        ))}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 14,
            padding: "6px 0",
            color: "#4a463f",
          }}
        >
          <span>Convenience fee</span>
          <span>₹{CONVENIENCE_FEE_RUPEES}</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 16,
            fontWeight: 700,
            marginTop: 10,
            paddingTop: 10,
            borderTop: "1px solid #f0ebe0",
          }}
        >
          <span>Total ({totalCount} items)</span>
          <span>₹{payableRupees}</span>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 18, padding: 18, marginBottom: 16 }}>
        <p className="eyebrow" style={{ color: "var(--mobile-hero)", margin: "0 0 6px" }}>
          Pickup for
        </p>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{name}</div>
      </div>

      {error && (
        <p style={{ color: "var(--status-new)", fontSize: 13, marginBottom: 12 }}>{error}</p>
      )}

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
        <button
          onClick={payAndPlaceOrder}
          style={{
            width: "100%",
            background: "var(--mobile-accent)",
            color: "#1c1c1a",
            border: "none",
            borderRadius: 16,
            padding: "16px 18px",
            fontWeight: 700,
            fontSize: 15,
            cursor: "pointer",
          }}
        >
          Pay · ₹{payableRupees}
        </button>
      </div>
    </div>
  );
}
