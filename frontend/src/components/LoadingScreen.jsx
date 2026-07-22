import React from "react";

export default function LoadingScreen({ message = "Loading your companion...", fullScreen = true }) {
  return (
    <div className={fullScreen ? "app-loading-screen" : "app-loading-inline"}>
      <div className="app-loading-card">
        <div className="app-loading-logo-wrapper">
          <div className="app-loading-logo">
            <svg
              width="36"
              height="36"
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
          <div className="app-loading-ring" />
        </div>

        <div className="app-loading-text-group">
          <h2 className="app-loading-title">Arnab's Assistant</h2>
          <p className="app-loading-message">{message}</p>
        </div>

        <div className="app-loading-bar-track">
          <div className="app-loading-bar-fill" />
        </div>
      </div>
    </div>
  );
}
