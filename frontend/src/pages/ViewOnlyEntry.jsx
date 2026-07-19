import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

export default function ViewOnlyEntry() {
  const [value, setValue] = useState("");
  const navigate = useNavigate();

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    // Accept either a bare token or a full pasted URL ending in /view/<token>
    const match = trimmed.match(/([a-f0-9]{20,})\s*$/i);
    const token = match ? match[1] : trimmed;
    navigate(`/view/${token}`);
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1 className="auth-title">View-only access</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 24 }}>
          Paste your view-only link or code to see attendance and calendar — no editing, no password needed.
        </p>
        <label className="label" htmlFor="token">View-only link or code</label>
        <input
          id="token"
          className="input"
          placeholder="Paste it here"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{ marginBottom: 16 }}
        />
        <button className="btn" type="submit" style={{ width: "100%" }}>Open</button>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 16, textAlign: "center" }}>
          Don't have one? <Link to="/login" style={{ color: "var(--accent)" }}>Log in</Link> and find it on your dashboard.
        </p>
      </form>
    </div>
  );
}
