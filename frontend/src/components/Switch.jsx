import React from "react";

// `ariaLabel` names the switch without rendering visible text, for the callers
// that already have a heading beside it and don't want the label duplicated.
export default function Switch({ checked, onChange, label, ariaLabel }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--text-muted)" }}>
      {label}
      {/* A real <button>, not the <span role="switch"> this used to be. The span had
          no tabIndex and no key handler, so the toggle could not be reached or
          operated from a keyboard at all — and because a <label> only names
          labelable elements, never a bare span, it also announced as an unnamed
          switch. <button> is labelable, so the wrapping label names it and makes
          the text itself clickable, and Enter/Space activation comes for free. */}
      <button
        type="button"
        onClick={() => onChange(!checked)}
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel || label || undefined}
        style={{
          width: 36,
          height: 20,
          borderRadius: 999,
          background: checked ? "var(--accent)" : "var(--border-strong)",
          position: "relative",
          transition: "background 0.15s",
          flexShrink: 0,
          border: "none",
          padding: 0,
          cursor: "pointer",
          display: "block",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#fff",
            transition: "left 0.15s",
          }}
        />
      </button>
    </label>
  );
}
