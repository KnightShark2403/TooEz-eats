export default function EmptyState({ icon, message, ctaLabel, onCta }) {
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        textAlign: "center",
        padding: 24,
      }}
    >
      {icon && <div style={{ fontSize: 36 }}>{icon}</div>}
      <p style={{ color: "#8a857a", fontSize: 14, margin: 0, maxWidth: 260 }}>{message}</p>
      {ctaLabel && (
        <button
          onClick={onCta}
          style={{
            background: "var(--mobile-dark-ui)",
            color: "#fff",
            border: "none",
            borderRadius: 14,
            padding: "12px 24px",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
