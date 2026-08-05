import { useNavigate } from "react-router-dom";
import { getStudentName } from "../lib/student.js";
import BottomTabBar from "./BottomTabBar.jsx";

export default function ProfileScreen() {
  const navigate = useNavigate();
  const name = getStudentName();

  const switchStudent = () => {
    localStorage.removeItem("tooez_student_name");
    navigate("/");
    window.location.reload();
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--mobile-bg)",
        maxWidth: 480,
        margin: "0 auto",
        padding: "28px 20px 110px",
      }}
    >
      <h1 style={{ fontSize: 24, margin: "0 0 20px", color: "#1c1c1a" }}>Profile</h1>
      <div style={{ background: "#fff", borderRadius: 18, padding: 18, marginBottom: 16 }}>
        <p className="eyebrow" style={{ color: "var(--mobile-hero)", margin: "0 0 6px" }}>
          Name
        </p>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{name}</div>
      </div>
      <button
        onClick={switchStudent}
        style={{
          background: "none",
          border: "1px solid #e4ddd0",
          borderRadius: 14,
          padding: "12px 16px",
          fontSize: 14,
          color: "#4a463f",
          cursor: "pointer",
        }}
      >
        Switch student
      </button>
      <BottomTabBar activeOrder={null} activeKey="Profile" />
    </div>
  );
}
