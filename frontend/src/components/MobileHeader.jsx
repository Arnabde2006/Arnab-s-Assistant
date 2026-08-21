import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import {
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  ChevronRight,
  LayoutDashboard,
  ClipboardCheck,
  CheckSquare,
  CalendarDays,
  BookOpen,
  GraduationCap,
  Wallet,
  ArrowLeftRight,
  CreditCard,
  Award,
  Timer,
  User
} from "lucide-react";

export const drawerLinks = [
  { to: "/", label: "Dashboard", subtitle: "Home & daily overview", icon: LayoutDashboard, end: true },
  { to: "/attendance", label: "Attendance", subtitle: "Bunk simulator & percentage tracker", icon: ClipboardCheck },
  { to: "/todos", label: "To‑do & Calendar", subtitle: "Tasks, calendar & automated reminders", icon: CheckSquare },
  { to: "/timetable", label: "Timetable", subtitle: "Weekly class schedule & room numbers", icon: CalendarDays },
  { to: "/exams", label: "Exam timetable", subtitle: "AI exam schedule & countdowns", icon: BookOpen },
  { to: "/grades", label: "Grades", subtitle: "SGPA/CGPA tracker & card reader", icon: GraduationCap },
  { to: "/finance", label: "Finance", subtitle: "Income, expenses & statement reader", icon: Wallet },
  { to: "/debts", label: "Debts", subtitle: "Track money owed & lent to friends", icon: ArrowLeftRight },
  { to: "/subscriptions", label: "Subscriptions", subtitle: "Free trials & auto-renewal charge alerts", icon: CreditCard },
  { to: "/nptel", label: "NPTEL Courses", subtitle: "Weekly assignment checklists & scores", icon: Award },
  { to: "/pomodoro", label: "Focus timer", subtitle: "Pomodoro timer & ambient sounds", icon: Timer },
  { to: "/profile", label: "Profile & Settings", subtitle: "Account, security & mobile preferences", icon: User },
];

export default function MobileHeader() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();

  const [navStyle, setNavStyle] = useState(() => localStorage.getItem("mobileNavStyle") || "bottom_bar");
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const handleStyleChange = () => {
      setNavStyle(localStorage.getItem("mobileNavStyle") || "bottom_bar");
    };
    window.addEventListener("mobileNavStyleChange", handleStyleChange);
    return () => window.removeEventListener("mobileNavStyleChange", handleStyleChange);
  }, []);

  if (!user) return null;

  const initial = user?.name ? user.name.charAt(0).toUpperCase() : "U";
  const isHamburgerMode = navStyle === "hamburger_drawer";

  return (
    <>
      <header className="mobile-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Hamburger 3-Line Menu Icon Button (Visible when hamburger_drawer style selected) */}
          {isHamburgerMode && (
            <button
              type="button"
              className="mobile-header-btn"
              onClick={() => setDrawerOpen(true)}
              title="Open Navigation Menu"
              aria-label="Open navigation menu"
              aria-expanded={drawerOpen}
              style={{ flexShrink: 0 }}
            >
              <Menu size={20} />
            </button>
          )}

          <Link to="/" className="mobile-header-brand">
            <div className="mobile-header-logo">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
            </div>
            <span className="mobile-header-title">Assistant</span>
          </Link>
        </div>

        <div className="mobile-header-actions">
          {/* Theme Toggle Button */}
          <button
            type="button"
            className="mobile-header-btn"
            onClick={() => setTheme(theme === "ink" ? "parchment" : "ink")}
            title={theme === "ink" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label={theme === "ink" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "ink" ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Profile Avatar Button */}
          <Link
            to="/profile"
            className={`mobile-header-avatar ${location.pathname === "/profile" ? "active" : ""}`}
            title="View Profile"
          >
            {initial}
          </Link>

          {/* Logout Button */}
          <button
            type="button"
            className="mobile-header-btn mobile-header-logout"
            onClick={logout}
            title="Log out"
            aria-label="Log out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Slide-Out Navigation Drawer */}
      {isHamburgerMode && drawerOpen && (
        <>
          {/* Dismiss-on-tap convenience only; the drawer has a real labelled
              close button, so keep this out of the accessibility tree rather than
              exposing an unnamed clickable region. */}
          <div
            className="mobile-drawer-backdrop"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside className="mobile-drawer-sheet">
            <div className="mobile-drawer-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="mobile-header-logo" style={{ width: 34, height: 34 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c3 3 9 3 12 0v-5" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16 }}>Arnab's Assistant</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Menu Navigation</div>
                </div>
              </div>
              <button
                type="button"
                className="mobile-header-btn"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mobile-drawer-body">
              {drawerLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setDrawerOpen(false)}
                    className={({ isActive }) => "mobile-drawer-item" + (isActive ? " active" : "")}
                  >
                    <div className="mobile-drawer-item-icon">
                      <Icon size={20} />
                    </div>
                    <div className="mobile-drawer-item-content">
                      <div className="mobile-drawer-item-title">{item.label}</div>
                      <div className="mobile-drawer-item-subtitle">{item.subtitle}</div>
                    </div>
                    <ChevronRight size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  </NavLink>
                );
              })}
            </div>
          </aside>
        </>
      )}
    </>
  );
}
