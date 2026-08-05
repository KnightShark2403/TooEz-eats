import { useState } from "react";
import { getStudentName, setStudentName } from "../lib/student.js";

export default function NameGate({ children }) {
  const [name, setName] = useState(getStudentName());
  const [draft, setDraft] = useState("");

  if (name) return children;

  const submit = (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setStudentName(draft);
    setName(draft.trim());
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--mobile-bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 360 }}>
        <p className="eyebrow" style={{ color: "var(--mobile-hero)", marginBottom: 8 }}>
          NHCE Canteen
        </p>
        <h1 style={{ fontSize: 28, margin: "0 0 8px", color: "#1c1c1a" }}>
          Welcome to <span style={{ color: "var(--mobile-accent)" }}>TooEz Eats</span>
        </h1>
        <p style={{ color: "#6b6b64", margin: "0 0 24px", fontSize: 14 }}>
          Enter your name to start pre-ordering.
        </p>
        <form onSubmit={submit}>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Your name"
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 14,
              border: "1px solid #e4ddd0",
              fontSize: 16,
              marginBottom: 12,
              background: "#fff",
            }}
          />
          <button
            type="submit"
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 14,
              border: "none",
              background: "var(--mobile-dark-ui)",
              color: "#fff",
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
