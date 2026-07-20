import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import ThemeToggle from "./ThemeToggle.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import {
  Home,
  ClipboardCheck,
  CheckSquare,
  CalendarDays,
  BookOpen,
  GraduationCap,
  Timer,
  MoreHorizontal
} from "lucide-react";

const primaryLinks = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/attendance", label: "Attend.", icon: ClipboardCheck },
  { to: "/todos", label: "Calendar", icon: CheckSquare },
  { to: "/timetable", label: "Classes", icon: CalendarDays },
];

const moreLinks = [
  { to: "/exams", label: "Exam timetable", icon: BookOpen },
  { to: "/grades", label: "Grades", icon: GraduationCap },
  { to: "/pomodoro", label: "Focus timer", icon: Timer },
];

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();

  return (
    <>
      <nav className="mobile-nav" aria-label="Primary">
        <div className="mobile-nav-inner">
          {primaryLinks.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => "mobile-nav-item" + (isActive ? " active" : "")}
              >
                <span className="icon" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={20} />
                </span>
                {link.label}
              </NavLink>
            );
          })}
          <button
            className={"mobile-nav-item" + (open ? " active" : "")}
            onClick={() => setOpen(true)}
            aria-haspopup="true"
            aria-expanded={open}
          >
            <span className="icon" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MoreHorizontal size={20} />
            </span>
            More
          </button>
        </div>
      </nav>

      {open && (
        <>
          <div className="mobile-sheet-backdrop" onClick={() => setOpen(false)} />
          <div className="mobile-sheet" role="dialog" aria-label="More options">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div className="label">More</div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 20, padding: 4 }}
              >
                ✕
              </button>
            </div>
            {moreLinks.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink key={link.to} to={link.to} className="mobile-sheet-link" onClick={() => setOpen(false)}>
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={18} />
                  </span>
                  {link.label}
                </NavLink>
              );
            })}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 8px 8px" }}>
              <span style={{ fontSize: 14, color: "var(--text-muted)" }}>Theme</span>
              <ThemeToggle />
            </div>
            {user && (
              <button
                className="btn-ghost btn"
                onClick={() => {
                  setOpen(false);
                  logout();
                }}
                style={{ width: "100%", marginTop: 12 }}
              >
                Log out ({user.name.split(" ")[0]})
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}
