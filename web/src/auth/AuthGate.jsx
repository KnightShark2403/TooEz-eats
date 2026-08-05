import { useState } from "react";
import { api } from "../lib/api.js";
import { getUser, setSession } from "../lib/auth.js";

const THEME = {
  student: {
    bg: "var(--mobile-bg)",
    card: "#fff",
    text: "#1c1c1a",
    subtext: "#6b6b64",
    border: "#e4ddd0",
    accentText: "var(--mobile-accent)",
    eyebrow: "var(--mobile-hero)",
    button: "var(--mobile-dark-ui)",
    buttonText: "#fff",
    brand: "NHCE Canteen",
    title: "Welcome to TooEz Eats",
    subtitle: "Sign in to start pre-ordering.",
  },
  staff: {
    bg: "var(--dash-bg)",
    card: "var(--dash-card)",
    text: "#f2ede4",
    subtext: "#8a8378",
    border: "#2a241d",
    accentText: "var(--dash-accent)",
    eyebrow: "#8a8378",
    button: "var(--dash-accent)",
    buttonText: "#1c1408",
    brand: "TooEz Eats",
    title: "Canteen staff login",
    subtitle: "Sign in to manage incoming orders.",
  },
  manager: {
    bg: "var(--dash-bg)",
    card: "var(--dash-card)",
    text: "#f2ede4",
    subtext: "#8a8378",
    border: "#2a241d",
    accentText: "var(--dash-accent)",
    eyebrow: "#8a8378",
    button: "var(--dash-accent)",
    buttonText: "#1c1408",
    brand: "TooEz Eats",
    title: "Manager login",
    subtitle: "Sign in to view income, analytics, and manage the menu.",
  },
};

// Gates its children behind login/signup for the given role. Renders
// children once a session for that exact role exists in localStorage.
export default function AuthGate({ role, children }) {
  const [user, setUser] = useState(getUser());
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (user && user.role === role) return children;

  const t = THEME[role];

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload =
        mode === "signup"
          ? { role, email: form.email, password: form.password, name: form.name }
          : { role, email: form.email, password: form.password };
      const result = mode === "signup" ? await api.signup(payload) : await api.login(payload);
      setSession(result.token, result.user);
      setUser(result.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const field = (key, label, type = "text") => (
    <div style={{ marginBottom: 12 }}>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        placeholder={label}
        required
        style={{
          width: "100%",
          padding: "14px 16px",
          borderRadius: 14,
          border: `1px solid ${t.border}`,
          fontSize: 16,
          background: role === "student" ? "#fff" : "#141210",
          color: t.text,
        }}
      />
    </div>
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: t.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 360 }}>
        <p className="eyebrow" style={{ color: t.eyebrow, marginBottom: 8 }}>
          {t.brand}
        </p>
        <h1 style={{ fontSize: 26, margin: "0 0 8px", color: t.text }}>
          {mode === "login" ? t.title : "Create your account"}
        </h1>
        <p style={{ color: t.subtext, margin: "0 0 20px", fontSize: 14 }}>
          {mode === "login" ? t.subtitle : `Sign up as ${role === "staff" ? "canteen staff" : "a student"}.`}
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {["login", "signup"].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 12,
                border: m === mode ? "none" : `1px solid ${t.border}`,
                background: m === mode ? t.button : "transparent",
                color: m === mode ? t.buttonText : t.subtext,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {m === "login" ? "Log in" : "Sign up"}
            </button>
          ))}
        </div>

        <form onSubmit={submit}>
          {mode === "signup" && field("name", "Your name")}
          {field("email", "Email", "email")}
          {field("password", "Password", "password")}

          {error && (
            <p style={{ color: "var(--status-new)", fontSize: 13, marginBottom: 12 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 14,
              border: "none",
              background: t.button,
              color: t.buttonText,
              fontSize: 16,
              fontWeight: 600,
              cursor: submitting ? "default" : "pointer",
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
