import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import ThemeToggle from "./ThemeToggle.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import {
  LayoutDashboard,
  ClipboardCheck,
  CheckSquare,
  CalendarDays,
  BookOpen,
  GraduationCap,
  Timer,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Wallet,
  ArrowLeftRight
} from "lucide-react";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/attendance", label: "Attendance", icon: ClipboardCheck },
  { to: "/todos", label: "To‑do & Calendar", icon: CheckSquare },
  { to: "/timetable", label: "Timetable", icon: CalendarDays },
  { to: "/exams", label: "Exam timetable", icon: BookOpen },
  { to: "/grades", label: "Grades", icon: GraduationCap },
  { to: "/finance", label: "Finance", icon: Wallet },
  { to: "/debts", label: "Debts", icon: ArrowLeftRight },
  { to: "/pomodoro", label: "Focus timer", icon: Timer },
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
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <div className="brand-tagline">Your personal college companion</div>

      {links.map((link) => {
        const Icon = link.icon;
        return (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
            title={isCollapsed ? link.label : ""}
          >
            <span className="nav-icon" style={{ display: "flex", alignItems: "center" }}>
              <Icon size={18} />
            </span>
            {!isCollapsed && <span className="nav-label">{link.label}</span>}
          </NavLink>
        );
      })}

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
            {isCollapsed ? <LogOut size={18} /> : `Log out (${user.name.split(" ")[0]})`}
          </button>
        )}
      </div>
    </div>
  );
}
