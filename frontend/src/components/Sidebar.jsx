import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import ThemeToggle from "./ThemeToggle.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const links = [
  { to: "/", label: "Dashboard", icon: "◆" },
  { to: "/attendance", label: "Attendance", icon: "◉" },
  { to: "/todos", label: "To‑do & Calendar", icon: "☰" },
  { to: "/timetable", label: "Timetable", icon: "▦" },
  { to: "/exams", label: "Exam timetable", icon: "✎" },
  { to: "/grades", label: "Grades", icon: "▲" },
  { to: "/pomodoro", label: "Focus timer", icon: "◷" },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem("sidebar-collapsed") === "true";
  });

  const toggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  };

  return (
    <div className={`sidebar ${isCollapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header">
        {!isCollapsed ? (
          <div className="brand">
            Arnab's Assistant<span className="dot">.</span>
          </div>
        ) : (
          <div className="brand" style={{ fontSize: 20, margin: 0 }}>
            A<span className="dot">.</span>
          </div>
        )}
        <button
          className="sidebar-toggle-btn"
          onClick={toggleCollapse}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label="Toggle Sidebar"
        >
          {isCollapsed ? "❯" : "❮"}
        </button>
      </div>

      <div className="brand-tagline">Your personal college companion</div>

      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.to === "/"}
          className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
          title={isCollapsed ? link.label : ""}
        >
          <span className="nav-icon">{link.icon}</span>
          {!isCollapsed && <span className="nav-label">{link.label}</span>}
        </NavLink>
      ))}

      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
        <ThemeToggle isCollapsed={isCollapsed} />
        {user && (
          <button
            className="btn-ghost btn"
            onClick={logout}
            title={isCollapsed ? `Log out (${user.name})` : "Log out"}
            style={{
              fontSize: 13,
              padding: isCollapsed ? "0" : "8px 16px",
              width: isCollapsed ? "44px" : "auto",
              height: isCollapsed ? "44px" : "auto",
              borderRadius: isCollapsed ? "50%" : "999px",
              margin: isCollapsed ? "0 auto" : "",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            {isCollapsed ? "↪" : `Log out (${user.name.split(" ")[0]})`}
          </button>
        )}
      </div>
    </div>
  );
}
