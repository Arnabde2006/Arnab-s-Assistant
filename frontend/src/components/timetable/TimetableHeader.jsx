import React from "react";
import {
  CalendarDays,
  Columns,
  Table,
  SlidersHorizontal,
  Sparkles,
  Plus,
} from "lucide-react";

export default function TimetableHeader({
  selectedClass,
  setSelectedClass,
  allClassesList,
  classSlotCounts,
  viewLayout,
  setViewLayout,
  showCustomizer,
  setShowCustomizer,
  showAiImport,
  setShowAiImport,
  showAddForm,
  setShowAddForm,
  isMobile,
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div className="flex-between" style={{ flexWrap: "wrap", gap: 16, marginBottom: 16 }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>
            Timetable
          </h1>
          <p className="page-subtitle" style={{ margin: "4px 0 0" }}>
            Class schedule, timing, and room assignments
          </p>
        </div>

        <div className="flex-gap-sm" style={{ flexWrap: "wrap" }}>
          {/* Layout switcher (Desktop only) */}
          {!isMobile && (
            <div
              style={{
                display: "inline-flex",
                background: "var(--bg-elevated)",
                padding: 3,
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
              }}
            >
              <button
                type="button"
                className={`btn ${viewLayout === "columns" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setViewLayout("columns")}
                style={{ padding: "6px 12px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
                aria-label="Switch to columns layout"
              >
                <Columns size={14} aria-hidden="true" />
                <span>Columns</span>
              </button>
              <button
                type="button"
                className={`btn ${viewLayout === "matrix" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setViewLayout("matrix")}
                style={{ padding: "6px 12px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
                aria-label="Switch to grid layout"
              >
                <Table size={14} aria-hidden="true" />
                <span>Grid</span>
              </button>
              <button
                type="button"
                className={`btn ${viewLayout === "agenda" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setViewLayout("agenda")}
                style={{ padding: "6px 12px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
                aria-label="Switch to agenda layout"
              >
                <CalendarDays size={14} aria-hidden="true" />
                <span>Agenda</span>
              </button>
            </div>
          )}

          {/* Customize Button */}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setShowCustomizer((v) => !v)}
            style={{
              padding: "7px 12px",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: showCustomizer ? "var(--accent-soft)" : "var(--bg-elevated)",
              border: "1px solid var(--border-strong)",
              color: showCustomizer ? "var(--accent)" : "var(--text)",
            }}
            aria-label="Toggle customizer panel"
          >
            <SlidersHorizontal size={14} aria-hidden="true" />
            <span>Customize</span>
          </button>

          {/* AI Import Button */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowAiImport((v) => !v)}
            style={{
              padding: "7px 14px",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: showAiImport ? "var(--accent-soft)" : "var(--bg-elevated)",
              border: "1px solid var(--border-strong)",
            }}
            aria-label="Import timetable with AI"
          >
            <Sparkles size={14} style={{ color: "var(--accent)" }} aria-hidden="true" />
            <span>AI Import</span>
          </button>

          {/* Add Slot Button */}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowAddForm((v) => !v)}
            style={{ padding: "7px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
            aria-label="Add class slot"
          >
            <Plus size={14} aria-hidden="true" />
            <span>Add Class</span>
          </button>
        </div>
      </div>

      {/* Preset Classes Bar */}
      <div
        className="custom-scrollbar"
        style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          paddingBottom: 4,
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginRight: 4, flexShrink: 0 }}>
          Class:
        </span>
        {allClassesList.map((cls) => {
          const count = classSlotCounts[cls] || 0;
          const isSelected = selectedClass === cls;
          return (
            <button
              key={cls}
              type="button"
              onClick={() => setSelectedClass(cls)}
              style={{
                padding: "4px 12px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: isSelected ? 700 : 500,
                background: isSelected ? "var(--accent)" : "var(--bg-elevated)",
                color: isSelected ? "#ffffff" : "var(--text-muted)",
                border: isSelected ? "1px solid var(--accent)" : "1px solid var(--border)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.15s ease",
              }}
            >
              <span>{cls}</span>
              {count > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    padding: "1px 5px",
                    borderRadius: 999,
                    background: isSelected ? "rgba(255,255,255,0.25)" : "var(--panel)",
                    color: isSelected ? "#fff" : "var(--text)",
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
