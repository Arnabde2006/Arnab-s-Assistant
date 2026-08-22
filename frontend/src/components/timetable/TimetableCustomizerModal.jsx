import React from "react";
import { SlidersHorizontal, Eye, EyeOff, X } from "lucide-react";

export default function TimetableCustomizerModal({
  showCustomizer,
  setShowCustomizer,
  showRoom,
  setShowRoom,
  showClassTag,
  setShowClassTag,
  hideWeekends,
  setHideWeekends,
  timetableTheme,
  setTimetableTheme,
  density,
  setDensity,
  THEMES,
}) {
  if (!showCustomizer) return null;

  return (
    <div className="card" style={{ marginBottom: 20, padding: 20 }}>
      <div className="flex-between" style={{ marginBottom: 16 }}>
        <div className="flex-gap-sm">
          <SlidersHorizontal size={18} style={{ color: "var(--accent)" }} />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            Customize View &amp; Display Preferences
          </h3>
        </div>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setShowCustomizer(false)}
          aria-label="Close customizer"
        >
          <X size={16} />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        {/* Theme Picker */}
        <div>
          <label className="label">Color Theme</label>
          <select
            className="input"
            value={timetableTheme}
            onChange={(e) => setTimetableTheme(e.target.value)}
          >
            {Object.entries(THEMES).map(([key, t]) => (
              <option key={key} value={key}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Display Density */}
        <div>
          <label className="label">Density</label>
          <select
            className="input"
            value={density}
            onChange={(e) => setDensity(e.target.value)}
          >
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </div>

        {/* Toggle Controls */}
        <div>
          <label className="label">Toggles</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={showRoom}
                onChange={(e) => setShowRoom(e.target.checked)}
              />
              <span>Show Room / Lab Locations</span>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={showClassTag}
                onChange={(e) => setShowClassTag(e.target.checked)}
              />
              <span>Show Class Tags</span>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={hideWeekends}
                onChange={(e) => setHideWeekends(e.target.checked)}
              />
              <span>Hide Sat/Sun (5-day week)</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
