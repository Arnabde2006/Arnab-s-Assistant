import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import {
  Home,
  ClipboardCheck,
  CheckSquare,
  CalendarDays,
  BookOpen,
  GraduationCap,
  Timer,
  LogOut,
  Sun,
  Moon
} from "lucide-react";

const links = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/attendance", label: "Attend.", icon: ClipboardCheck },
  { to: "/todos", label: "Calendar", icon: CheckSquare },
  { to: "/timetable", label: "Classes", icon: CalendarDays },
  { to: "/exams", label: "Exams", icon: BookOpen },
  { to: "/grades", label: "Grades", icon: GraduationCap },
  { to: "/pomodoro", label: "Timer", icon: Timer },
];

export default function MobileNav() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <nav className="mobile-nav" aria-label="Primary">
      <div className="mobile-nav-inner">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => "mobile-nav-item" + (isActive ? " active" : "")}
            >
              <span className="icon" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={18} />
              </span>
              {link.label}
            </NavLink>
          );
        })}

        {/* Theme Toggle Button */}
        <button
          className="mobile-nav-item"
          onClick={() => setTheme(theme === "ink" ? "parchment" : "ink")}
          title={theme === "ink" ? "Switch to Parchment (light)" : "Switch to Ink (dark)"}
          style={{ cursor: "pointer" }}
        >
          <span className="icon" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            {theme === "ink" ? <Sun size={18} /> : <Moon size={18} />}
          </span>
          Theme
        </button>

        {/* Logout Button */}
        {user && (
          <button
            className="mobile-nav-item"
            onClick={logout}
            title="Log out"
            style={{ cursor: "pointer" }}
          >
            <span className="icon" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <LogOut size={18} />
            </span>
            Log out
          </button>
        )}
      </div>
    </nav>
  );
}
