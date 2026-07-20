import React from "react";
import { useTheme } from "../context/ThemeContext.jsx";

export default function ThemeToggle({ isCollapsed }) {
  const { theme, setTheme } = useTheme();

  if (isCollapsed) {
    return (
      <button
        className="theme-toggle-btn active"
        onClick={() => setTheme(theme === "ink" ? "parchment" : "ink")}
        title={theme === "ink" ? "Switch to Parchment (light)" : "Switch to Ink (dark)"}
        style={{
          margin: "0 auto",
          width: "44px",
          height: "44px",
          borderRadius: "50%",
          display: "flex",
          background: "rgba(255, 255, 255, 0.08)",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--accent)",
          border: "1px solid var(--border)",
          cursor: "pointer",
          padding: 0,
          transition: "transform 0.15s ease, background 0.2s ease"
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.08)";
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
        }}
      >
        {theme === "ink" ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        )}
      </button>
    );
  }

  return (
    <div className="theme-toggle" role="group" aria-label="Theme switcher">
      <span
        className="theme-toggle-slider"
        style={{
          transform: theme === "parchment" ? "translateX(34px)" : "translateX(0px)",
        }}
      />
      <button
        className={`theme-toggle-btn ${theme === "ink" ? "active" : ""}`}
        onClick={() => setTheme("ink")}
        title="Ink (dark)"
        aria-label="Ink theme"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill={theme === "ink" ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </button>
      <button
        className={`theme-toggle-btn ${theme === "parchment" ? "active" : ""}`}
        onClick={() => setTheme("parchment")}
        title="Parchment (light)"
        aria-label="Parchment theme"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill={theme === "parchment" ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      </button>
    </div>
  );
}
