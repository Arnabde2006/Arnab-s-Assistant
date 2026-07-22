import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { Sun, Moon, LogOut, User } from "lucide-react";

export default function MobileHeader() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();

  if (!user) return null;

  const initial = user?.name ? user.name.charAt(0).toUpperCase() : "U";

  return (
    <header className="mobile-header">
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

      <div className="mobile-header-actions">
        {/* Theme Toggle Button */}
        <button
          type="button"
          className="mobile-header-btn"
          onClick={() => setTheme(theme === "ink" ? "parchment" : "ink")}
          title={theme === "ink" ? "Switch to Light Mode" : "Switch to Dark Mode"}
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
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
