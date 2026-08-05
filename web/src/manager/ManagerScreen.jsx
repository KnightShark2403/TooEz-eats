import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { getUser, clearSession } from "../lib/auth.js";
import IncomeChart from "./IncomeChart.jsx";

const CATEGORIES = ["Mains", "Rice & Bowls", "Snacks", "Beverages", "Desserts"];

export default function ManagerScreen() {
  const [analytics, setAnalytics] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [newItem, setNewItem] = useState({ name: "", price_rupees: "", category: CATEGORIES[0] });

  const loadAll = () => {
    api.getAnalytics().then(setAnalytics).catch((e) => setError(e.message));
    api.getAllMenuItems().then(setItems).catch((e) => setError(e.message));
  };

  useEffect(loadAll, []);

  const toggleAvailable = async (item) => {
    try {
      const updated = await api.updateMenuItem(item.id, { available: !item.available });
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    } catch (e) {
      setError(e.message);
    }
  };

  const removeItem = async (item) => {
    try {
      await api.deleteMenuItem(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (e) {
      setError(e.message);
    }
  };

  const addItem = async (e) => {
    e.preventDefault();
    const price = Number(newItem.price_rupees);
    if (!newItem.name.trim() || !Number.isInteger(price) || price < 0) {
      setError("Enter a name and a whole-number price to add an item.");
      return;
    }
    try {
      const created = await api.createMenuItem({
        name: newItem.name.trim(),
        price_rupees: price,
        category: newItem.category,
      });
      setItems((prev) => [...prev, created]);
      setNewItem({ name: "", price_rupees: "", category: CATEGORIES[0] });
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

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
                Manager Console
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
            <span>📊</span>
            Income & Menu
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, color: "#8a8378", marginBottom: 8 }}>{getUser()?.name}</div>
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
        <h1 style={{ fontSize: 26, margin: "0 0 6px", color: "#f2ede4" }}>Manager overview</h1>
        <p style={{ color: "#8a8378", margin: "0 0 24px", fontSize: 14 }}>
          Revenue, order stats, and menu control.
        </p>

        {error && (
          <p style={{ color: "var(--status-new)", marginBottom: 16 }}>{error}</p>
        )}

        {analytics && (
          <>
            <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
              <StatCard label="Total orders" value={analytics.totalOrders} />
              <StatCard label="Total revenue" value={`₹${analytics.totalRevenue}`} />
              <StatCard label="Avg order value" value={`₹${analytics.averageOrderValue}`} />
            </div>

            <Card title="Revenue by day">
              <IncomeChart data={analytics.revenueByDay} />
            </Card>

            <Card title="Top-selling items">
              {analytics.topItems.length === 0 ? (
                <p style={{ color: "#8a8378", fontSize: 13 }}>No orders yet.</p>
              ) : (
                <div>
                  {analytics.topItems.map((item, i) => (
                    <div
                      key={item.name}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 0",
                        borderTop: i === 0 ? "none" : "1px solid #241f19",
                        color: "#f2ede4",
                        fontSize: 14,
                      }}
                    >
                      <span>{item.name}</span>
                      <span style={{ color: "#8a8378" }}>{item.quantity} sold</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}

        <Card title="Menu control">
          <form
            onSubmit={addItem}
            style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}
          >
            <input
              placeholder="Item name"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              style={inputStyle}
            />
            <input
              placeholder="Price (₹)"
              type="number"
              min="0"
              value={newItem.price_rupees}
              onChange={(e) => setNewItem({ ...newItem, price_rupees: e.target.value })}
              style={{ ...inputStyle, width: 100 }}
            />
            <select
              value={newItem.category}
              onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
              style={inputStyle}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button type="submit" style={addButtonStyle}>
              Add item
            </button>
          </form>

          <div>
            {items.map((item, i) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 0",
                  borderTop: i === 0 ? "none" : "1px solid #241f19",
                }}
              >
                <div>
                  <div style={{ color: "#f2ede4", fontSize: 14, fontWeight: 600 }}>
                    {item.name}
                  </div>
                  <div style={{ color: "#8a8378", fontSize: 12 }}>
                    {item.category} · ₹{item.price_rupees}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    onClick={() => toggleAvailable(item)}
                    style={{
                      ...pillButtonStyle,
                      background: item.available ? "rgba(76,175,110,0.15)" : "rgba(122,138,127,0.15)",
                      color: item.available ? "var(--status-ready)" : "var(--status-completed)",
                    }}
                  >
                    {item.available ? "Available today" : "Unavailable"}
                  </button>
                  <button onClick={() => removeItem(item)} style={removeButtonStyle}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </main>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={{ background: "var(--dash-card)", borderRadius: 16, padding: "16px 20px", minWidth: 140 }}>
      <div className="eyebrow" style={{ color: "#8a8378", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: "#f2ede4" }}>{value}</div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div style={{ background: "var(--dash-card)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
      <p className="eyebrow" style={{ color: "#8a8378", margin: "0 0 12px" }}>
        {title}
      </p>
      {children}
    </div>
  );
}

const inputStyle = {
  flex: 1,
  minWidth: 120,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #2a241d",
  background: "#141210",
  color: "#f2ede4",
  fontSize: 13,
};

const addButtonStyle = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "none",
  background: "var(--dash-accent)",
  color: "#1c1408",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};

const pillButtonStyle = {
  border: "none",
  borderRadius: 999,
  padding: "6px 12px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const removeButtonStyle = {
  border: "1px solid #2a241d",
  background: "none",
  borderRadius: 10,
  padding: "6px 12px",
  fontSize: 12,
  color: "#c8c0b2",
  cursor: "pointer",
};
