import { useNavigate } from "react-router-dom";

const STATUS_TABS = [
  { key: "Home", label: "Home", icon: "🏠" },
  { key: "New", label: "Placed", icon: "📝" },
  { key: "Accepted", label: "Accepted", icon: "✅" },
  { key: "Preparing", label: "Preparing", icon: "🍳" },
  { key: "Ready for Pickup", label: "Ready", icon: "🛎️" },
  { key: "Profile", label: "Profile", icon: "👤" },
];

// activeOrder: { id, status } | null. activeKey: which tab is highlighted ("Home" | "Profile" | a status).
export default function BottomTabBar({ activeOrder, activeKey }) {
  const navigate = useNavigate();

  const go = (tab) => {
    if (tab.key === "Home") return navigate("/");
    if (tab.key === "Profile") return navigate("/profile");
    if (activeOrder) return navigate(`/order/${activeOrder.id}`);
  };

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        background: "#fff",
        borderTop: "1px solid #eee6d8",
        padding: "10px 4px calc(10px + env(safe-area-inset-bottom))",
        maxWidth: 480,
        margin: "0 auto",
      }}
    >
      {STATUS_TABS.map((tab) => {
        const isActive = tab.key === activeKey;
        const isOrderTab = !["Home", "Profile"].includes(tab.key);
        const isReachable = tab.key === "Home" || tab.key === "Profile" || activeOrder;
        return (
          <button
            key={tab.key}
            onClick={() => go(tab)}
            disabled={isOrderTab && !activeOrder}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              background: "none",
              border: "none",
              cursor: isReachable ? "pointer" : "default",
              opacity: isOrderTab && !activeOrder ? 0.3 : 1,
              color: isActive ? "var(--mobile-accent)" : "#8a857a",
              fontSize: 10,
              fontWeight: isActive ? 700 : 500,
              padding: "4px 6px",
            }}
          >
            <span
              style={{
                fontSize: 18,
                lineHeight: 1,
                filter: isActive ? "none" : "grayscale(60%)",
              }}
            >
              {tab.icon}
            </span>
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
