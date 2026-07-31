import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Settings,
  Sparkles,
  Plus,
  Clock,
  MapPin,
  Trash2,
  Eye,
  EyeOff,
  Columns,
  Table,
  CalendarDays,
  Palette,
  SlidersHorizontal,
  Pencil,
  X,
  Save,
} from "lucide-react";
import { api } from "../api/client.js";
import { fileToBase64 } from "../utils/fileToBase64.js";
import FileUpload from "../components/FileUpload.jsx";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PRESET_CLASSES = [
  "BCA 2A",
  "BCA 1A",
  "BCA 1B",
  "BCA 1C",
  "BCA 1D",
  "BCA 2B",
  "BCA 2C",
  "BCA 3A",
  "BCA 3B",
  "BCA 3C",
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year",
];

const THEMES = {
  ink: {
    name: "Frosted Ink",
    bg: "var(--panel)",
    border: "var(--border)",
    cardBg: "var(--bg-elevated)",
    accent: "var(--accent)",
    accentText: "#ffffff",
  },
  cyberpunk: {
    name: "Neon Cyberpunk",
    bg: "#090d16",
    border: "#1e293b",
    cardBg: "#111827",
    accent: "#00f2fe",
    accentText: "#030712",
  },
  pastel: {
    name: "Soft Pastel",
    bg: "rgba(255, 255, 255, 0.05)",
    border: "rgba(255, 255, 255, 0.12)",
    cardBg: "rgba(255, 255, 255, 0.08)",
    accent: "#a855f7",
    accentText: "#ffffff",
  },
  gold: {
    name: "Academic Gold",
    bg: "#161310",
    border: "#33291e",
    cardBg: "#211c16",
    accent: "#eab308",
    accentText: "#18181b",
  },
  minimal: {
    name: "Minimal Mono",
    bg: "#09090b",
    border: "#27272a",
    cardBg: "#18181b",
    accent: "#e4e4e7",
    accentText: "#09090b",
  },
};

export default function Timetable() {
  const [subjects, setSubjects] = useState([]);
  const [slots, setSlots] = useState([]);
  const [selectedClass, setSelectedClass] = useState(() => {
    return localStorage.getItem("timetable_selected_class") || "BCA 2A";
  });

  // Preference states
  const [hideWeekends, setHideWeekends] = useState(() => {
    const saved = localStorage.getItem("timetable_hide_weekends");
    return saved !== null ? saved === "true" : true;
  });

  const [viewLayout, setViewLayout] = useState(() => {
    return localStorage.getItem("timetable_view_layout") || "columns"; // "columns" | "matrix" | "agenda"
  });

  const [timetableTheme, setTimetableTheme] = useState(() => {
    return localStorage.getItem("timetable_theme") || "ink";
  });

  const [density, setDensity] = useState(() => {
    return localStorage.getItem("timetable_density") || "comfortable"; // "comfortable" | "compact"
  });

  const [showRoom, setShowRoom] = useState(true);
  const [showClassTag, setShowClassTag] = useState(true);

  // UI Accordion & Modal states
  const [showAiImport, setShowAiImport] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showCustomizer, setShowCustomizer] = useState(false);

  // Individual Slot Edit State
  const [editingSlot, setEditingSlot] = useState(null);
  const [editForm, setEditForm] = useState({
    subjectId: "",
    subjectName: "",
    dayOfWeek: 1,
    startTime: "09:30",
    endTime: "10:20",
    room: "",
    className: "BCA 2A",
  });
  const [editSubmitting, setEditSubmitting] = useState(false);

  // AI Upload State
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");

  // Form State
  const [form, setForm] = useState({
    subjectId: "",
    subjectName: "",
    className: "BCA 2A",
    dayOfWeek: 1,
    startTime: "09:30",
    endTime: "10:20",
    room: "",
  });
  const [pageLoading, setPageLoading] = useState(true);

  const currentDayIndex = new Date().getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  // Sync preferences to localStorage
  useEffect(() => {
    try { localStorage.setItem("timetable_selected_class", selectedClass); } catch {}
    if (selectedClass !== "All") {
      setForm((f) => ({ ...f, className: selectedClass }));
    }
  }, [selectedClass]);

  useEffect(() => {
    try { localStorage.setItem("timetable_hide_weekends", hideWeekends); } catch {}
  }, [hideWeekends]);

  useEffect(() => {
    try { localStorage.setItem("timetable_view_layout", viewLayout); } catch {}
  }, [viewLayout]);

  useEffect(() => {
    try { localStorage.setItem("timetable_theme", timetableTheme); } catch {}
  }, [timetableTheme]);

  useEffect(() => {
    try { localStorage.setItem("timetable_density", density); } catch {}
  }, [density]);

  async function refresh() {
    try {
      const [s, t] = await Promise.all([api.get("/subjects"), api.get("/timetable")]);
      setSubjects(s.subjects);
      setSlots(t.slots);
      if (s.subjects.length > 0 && !form.subjectId) {
        setForm((f) => ({ ...f, subjectId: s.subjects[0].id, subjectName: "" }));
      } else if (s.subjects.length === 0) {
        setForm((f) => ({ ...f, subjectId: "NEW", subjectName: "" }));
      }
    } finally {
      setPageLoading(false);
    }
  }

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  // ── Start Editing a Slot ───────────────────────────────────────────────
  const startEditSlot = (slot) => {
    setEditingSlot(slot);
    setEditForm({
      subjectId: slot.subject?._id || "",
      subjectName: slot.subject?.name || "",
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime || "09:30",
      endTime: slot.endTime || "10:20",
      room: slot.room || "",
      className: slot.className || selectedClass || "BCA 2A",
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingSlot) return;
    setEditSubmitting(true);
    try {
      await api.put(`/timetable/${editingSlot._id}`, {
        subjectId: editForm.subjectId === "NEW" ? "" : editForm.subjectId,
        subjectName: editForm.subjectName,
        dayOfWeek: editForm.dayOfWeek,
        startTime: editForm.startTime,
        endTime: editForm.endTime,
        room: editForm.room,
        className: editForm.className,
      });
      setEditingSlot(null);
      refresh();
    } catch (err) {
      alert(err.message || "Failed to update class slot");
    } finally {
      setEditSubmitting(false);
    }
  };

  // ── AI Timetable Extractor ──────────────────────────────────────────────
  const processImageFile = useCallback(
    async (file) => {
      if (!file) return;
      setUploadError("");
      setUploadSuccess("");
      setUploading(true);

      try {
        const fileBase64 = await fileToBase64(file);
        const targetClass = selectedClass !== "All" ? selectedClass : "BCA 2A";
        const data = await api.post("/ai/class-timetable", {
          fileBase64,
          mimeType: file.type || "image/png",
          className: targetClass,
        });

        if (data.count > 0) {
          setUploadSuccess(`Success! Added ${data.count} class slot(s) to ${targetClass} timetable.`);
          setUploadFile(null);
          refresh();
        } else {
          setUploadError(`No class slots found for ${targetClass} — try a clearer photo or PDF.`);
        }
      } catch (err) {
        setUploadError(err.message || "Failed to process timetable image.");
      } finally {
        setUploading(false);
      }
    },
    [selectedClass]
  );

  // ── Clipboard Paste Listener (Ctrl+V / Cmd+V) ──────────────────────────
  const handleClipboardPaste = useCallback(
    (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            setUploadFile(file);
            setShowAiImport(true);
            processImageFile(file);
          }
          break;
        }
      }
    },
    [processImageFile]
  );

  useEffect(() => {
    window.addEventListener("paste", handleClipboardPaste);
    return () => window.removeEventListener("paste", handleClipboardPaste);
  }, [handleClipboardPaste]);

  const handleAiFormSubmit = (e) => {
    e.preventDefault();
    if (uploadFile) {
      processImageFile(uploadFile);
    }
  };

  // ── Class slot calculations & Day filtering ──────────────────────────────
  const slotClasses = slots.map((s) => s.className || "BCA 2A");
  const allClassesList = Array.from(new Set([...PRESET_CLASSES, ...slotClasses]));

  const classSlotCounts = {};
  allClassesList.forEach((cls) => {
    classSlotCounts[cls] = slots.filter((s) => (s.className || "BCA 2A") === cls).length;
  });

  const filteredSlots = useMemo(() => {
    return slots.filter((s) => {
      if (selectedClass === "All") return true;
      return (s.className || "BCA 2A") === selectedClass;
    });
  }, [slots, selectedClass]);

  // Display days list (5 or 7 days)
  const displayDays = useMemo(() => {
    return DAYS.map((dayName, index) => ({ dayName, index })).filter(({ index }) => {
      if (hideWeekends) {
        return index >= 1 && index <= 5; // Mon to Fri
      }
      return true;
    });
  }, [hideWeekends]);

  // Extract unique time periods across all filtered slots (for Matrix view)
  const timePeriods = useMemo(() => {
    const periodMap = new Map();
    filteredSlots.forEach((s) => {
      if (s.startTime && s.endTime) {
        const key = `${s.startTime}-${s.endTime}`;
        periodMap.set(key, { startTime: s.startTime, endTime: s.endTime, key });
      }
    });
    return Array.from(periodMap.values()).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [filteredSlots]);

  const activeTheme = THEMES[timetableTheme] || THEMES.ink;
  const isCompact = density === "compact";

  if (pageLoading) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Timetable</h1>
            <p className="page-subtitle">Retrieving weekly class schedule...</p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="skeleton-pulse" style={{ width: 90, height: 36, borderRadius: 999 }} />
          ))}
        </div>

        <div className="grid" style={{ gridTemplateColumns: hideWeekends ? "repeat(5, 1fr)" : "repeat(7, 1fr)", gap: 12 }}>
          {displayDays.map(({ dayName }) => (
            <div key={dayName} className="card" style={{ minHeight: 180 }}>
              <div className="skeleton-pulse skeleton-text" style={{ width: "50%", height: 14, borderRadius: 4, marginBottom: 12 }} />
              <div className="skeleton-pulse skeleton-text" style={{ width: "90%", height: 40, borderRadius: 8, marginBottom: 8 }} />
              <div className="skeleton-pulse skeleton-text" style={{ width: "90%", height: 40, borderRadius: 8 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  async function addSlot(e) {
    e.preventDefault();
    if (form.subjectId === "NEW" && !form.subjectName.trim()) {
      return;
    }
    if (!form.subjectId && !form.subjectName.trim()) return;

    await api.post("/timetable", {
      subjectId: form.subjectId === "NEW" ? "" : form.subjectId,
      subjectName: form.subjectName,
      dayOfWeek: form.dayOfWeek,
      startTime: form.startTime,
      endTime: form.endTime,
      room: form.room,
      className: form.className,
    });
    refresh();
  }

  async function removeSlot(id) {
    await api.del(`/timetable/${id}`);
    refresh();
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="page-title">Timetable</h1>
          <p className="page-subtitle">Weekly class schedule &amp; customizable routine manager.</p>
        </div>

        {/* Action Toggle Buttons */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setShowCustomizer(!showCustomizer)}
            style={{
              fontSize: 13,
              padding: "7px 14px",
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: showCustomizer ? "var(--accent-soft)" : undefined,
              borderColor: showCustomizer ? "var(--accent)" : undefined,
              color: showCustomizer ? "var(--accent)" : undefined,
            }}
          >
            <Settings size={15} />
            <span>{showCustomizer ? "Close Customizer" : "Customize View"}</span>
          </button>

          <button
            type="button"
            className="btn-ghost"
            onClick={() => setShowAiImport(!showAiImport)}
            style={{
              fontSize: 13,
              padding: "7px 14px",
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: showAiImport ? "var(--accent-soft)" : undefined,
              borderColor: showAiImport ? "var(--accent)" : undefined,
              color: showAiImport ? "var(--accent)" : undefined,
            }}
          >
            <Sparkles size={15} />
            <span>{showAiImport ? "Hide AI Import" : "AI Import"}</span>
          </button>

          <button
            type="button"
            className="btn-ghost"
            onClick={() => setShowAddForm(!showAddForm)}
            style={{
              fontSize: 13,
              padding: "7px 14px",
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: showAddForm ? "var(--accent-soft)" : undefined,
              borderColor: showAddForm ? "var(--accent)" : undefined,
              color: showAddForm ? "var(--accent)" : undefined,
            }}
          >
            <Plus size={15} />
            <span>{showAddForm ? "Close Form" : "Add Class"}</span>
          </button>
        </div>
      </div>

      {/* Control Bar: Class Selector & View Mode Pills */}
      <div
        className="card"
        style={{
          marginBottom: 20,
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        {/* Class Pills */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="label" style={{ margin: 0, marginRight: 4 }}>Class:</span>
          {allClassesList.map((cls) => {
            const isActive = selectedClass === cls;
            const count = classSlotCounts[cls] || 0;
            return (
              <button
                key={cls}
                type="button"
                onClick={() => setSelectedClass(cls)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  border: isActive ? `1.5px solid ${activeTheme.accent}` : "1px solid var(--border)",
                  background: isActive ? "var(--accent-soft)" : "var(--bg-elevated)",
                  color: isActive ? activeTheme.accent : "var(--text)",
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.15s ease",
                }}
              >
                <span>{cls}</span>
                {count > 0 && (
                  <span
                    style={{
                      fontSize: 11,
                      padding: "1px 6px",
                      borderRadius: 999,
                      background: isActive ? activeTheme.accent : "var(--border-strong)",
                      color: isActive ? activeTheme.accentText : "var(--text-muted)",
                      fontWeight: 700,
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setSelectedClass("All")}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: selectedClass === "All" ? `1.5px solid ${activeTheme.accent}` : "1px solid var(--border)",
              background: selectedClass === "All" ? "var(--accent-soft)" : "var(--bg-elevated)",
              color: selectedClass === "All" ? activeTheme.accent : "var(--text)",
              fontWeight: selectedClass === "All" ? 700 : 500,
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.15s ease",
            }}
          >
            <span>All Classes</span>
            <span
              style={{
                fontSize: 11,
                padding: "1px 6px",
                borderRadius: 999,
                background: selectedClass === "All" ? activeTheme.accent : "var(--border-strong)",
                color: selectedClass === "All" ? activeTheme.accentText : "var(--text-muted)",
                fontWeight: 700,
              }}
            >
              {slots.length}
            </span>
          </button>
        </div>

        {/* Right Controls: View Layout Switcher & Weekend Toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Layout Mode Segmented Control */}
          <div style={{ display: "flex", background: "var(--bg-elevated)", padding: 3, borderRadius: 999, border: "1px solid var(--border)" }}>
            <button
              type="button"
              onClick={() => setViewLayout("columns")}
              title="Vertical Day Columns"
              style={{
                padding: "5px 12px",
                borderRadius: 999,
                border: "none",
                background: viewLayout === "columns" ? activeTheme.accent : "transparent",
                color: viewLayout === "columns" ? activeTheme.accentText : "var(--text-muted)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Columns size={14} />
              <span>Columns</span>
            </button>

            <button
              type="button"
              onClick={() => setViewLayout("matrix")}
              title="Horizontal Routine Matrix (Routine Sheet format)"
              style={{
                padding: "5px 12px",
                borderRadius: 999,
                border: "none",
                background: viewLayout === "matrix" ? activeTheme.accent : "transparent",
                color: viewLayout === "matrix" ? activeTheme.accentText : "var(--text-muted)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Table size={14} />
              <span>Routine Matrix</span>
            </button>

            <button
              type="button"
              onClick={() => setViewLayout("agenda")}
              title="Chronological Agenda Timeline"
              style={{
                padding: "5px 12px",
                borderRadius: 999,
                border: "none",
                background: viewLayout === "agenda" ? activeTheme.accent : "transparent",
                color: viewLayout === "agenda" ? activeTheme.accentText : "var(--text-muted)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <CalendarDays size={14} />
              <span>Agenda</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setHideWeekends(!hideWeekends)}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: hideWeekends ? "rgba(79, 168, 138, 0.14)" : "var(--bg-elevated)",
              color: hideWeekends ? "var(--present)" : "var(--text-muted)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {hideWeekends ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>{hideWeekends ? "Hide Sat/Sun" : "Show All 7 Days"}</span>
          </button>
        </div>
      </div>

      {/* ── TIMETABLE MAIN DISPLAY VIEW ────────────────────────────────────── */}
      <div
        style={{
          background: activeTheme.bg,
          border: `1px solid ${activeTheme.border}`,
          borderRadius: "var(--radius-md)",
          padding: isCompact ? "12px" : "18px",
          marginBottom: 24,
          transition: "all 0.2s ease",
        }}
      >
        {/* VIEW LAYOUT 1: Day Columns (Grid) */}
        {viewLayout === "columns" && (
          <div
            className="grid timetable-grid"
            style={{
              gridTemplateColumns: hideWeekends ? "repeat(5, 1fr)" : "repeat(7, 1fr)",
              gap: isCompact ? 8 : 12,
              alignItems: "stretch",
            }}
          >
            {displayDays.map(({ dayName, index: dayIdx }) => {
              const isToday = currentDayIndex === dayIdx;
              const daySlots = filteredSlots
                .filter((s) => s.dayOfWeek === dayIdx)
                .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));

              return (
                <div
                  key={dayName}
                  style={{
                    minHeight: isCompact ? 160 : 220,
                    padding: isCompact ? "10px" : "14px",
                    display: "flex",
                    flexDirection: "column",
                    borderRadius: "var(--radius-sm)",
                    border: isToday ? `1.5px solid ${activeTheme.accent}` : `1px solid ${activeTheme.border}`,
                    background: activeTheme.cardBg,
                    boxShadow: isToday ? `0 4px 20px rgba(0, 242, 254, 0.15)` : "none",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 10,
                      paddingBottom: 6,
                      borderBottom: `1px solid ${activeTheme.border}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: isCompact ? 14 : 15,
                          fontWeight: 700,
                          color: isToday ? activeTheme.accent : "var(--text)",
                        }}
                      >
                        {dayName}
                      </span>
                      {isToday && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 800,
                            padding: "2px 5px",
                            borderRadius: 999,
                            background: activeTheme.accent,
                            color: activeTheme.accentText,
                            textTransform: "uppercase",
                          }}
                        >
                          Today
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>
                      {daySlots.length}
                    </span>
                  </div>

                  {daySlots.length === 0 ? (
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        color: "var(--text-muted)",
                        fontStyle: "italic",
                        opacity: 0.6,
                      }}
                    >
                      No classes
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: isCompact ? 6 : 10, flex: 1 }}>
                      {daySlots.map((s) => (
                        <SlotCard
                          key={s._id}
                          slot={s}
                          activeTheme={activeTheme}
                          isCompact={isCompact}
                          showRoom={showRoom}
                          showClassTag={showClassTag}
                          selectedClass={selectedClass}
                          onEdit={startEditSlot}
                          onRemove={removeSlot}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* VIEW LAYOUT 2: Routine Matrix (Official College Time-Period × Day Table Format) */}
        {viewLayout === "matrix" && (
          <div
            className="custom-scrollbar"
            style={{
              overflowX: "auto",
              paddingBottom: 8,
              "--scrollbar-track": activeTheme.cardBg,
              "--scrollbar-thumb": activeTheme.accent,
              "--scrollbar-thumb-hover": activeTheme.accent,
            }}
          >
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 6 }}>
              <thead>
                <tr>
                  <th style={{ padding: "10px", textAlign: "left", fontSize: 13, fontWeight: 700, borderBottom: `1px solid ${activeTheme.border}`, color: "var(--text-muted)", minWidth: 90 }}>
                    Day / Time
                  </th>
                  {timePeriods.length === 0 ? (
                    <th style={{ padding: "10px", fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>No time slots available</th>
                  ) : (
                    timePeriods.map((tp) => (
                      <th
                        key={tp.key}
                        style={{
                          padding: "8px 12px",
                          textAlign: "center",
                          fontSize: 12,
                          fontWeight: 700,
                          borderBottom: `1px solid ${activeTheme.border}`,
                          color: activeTheme.accent,
                          background: "var(--bg-elevated)",
                          borderRadius: "var(--radius-sm)",
                          minWidth: 120,
                        }}
                      >
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                          <Clock size={13} />
                          <span>{tp.startTime} – {tp.endTime}</span>
                        </div>
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {displayDays.map(({ dayName, index: dayIdx }) => {
                  const isToday = currentDayIndex === dayIdx;
                  return (
                    <tr key={dayName}>
                      <td
                        style={{
                          padding: "12px 10px",
                          fontWeight: 700,
                          fontSize: 14,
                          color: isToday ? activeTheme.accent : "var(--text)",
                          background: isToday ? "var(--accent-soft)" : "transparent",
                          borderRadius: "var(--radius-sm)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span>{dayName}</span>
                          {isToday && <span style={{ fontSize: 9, background: activeTheme.accent, color: activeTheme.accentText, padding: "1px 5px", borderRadius: 4, fontWeight: 800 }}>TODAY</span>}
                        </div>
                      </td>

                      {timePeriods.map((tp) => {
                        const slot = filteredSlots.find(
                          (s) => s.dayOfWeek === dayIdx && s.startTime === tp.startTime && s.endTime === tp.endTime
                        );

                        return (
                          <td
                            key={tp.key}
                            style={{
                              padding: 4,
                              verticalAlign: "top",
                            }}
                          >
                            {slot ? (
                              <SlotCard
                                slot={slot}
                                activeTheme={activeTheme}
                                isCompact={true}
                                showRoom={showRoom}
                                showClassTag={showClassTag}
                                selectedClass={selectedClass}
                                onEdit={startEditSlot}
                                onRemove={removeSlot}
                              />
                            ) : (
                              <div
                                style={{
                                  height: 48,
                                  border: `1px dashed ${activeTheme.border}`,
                                  borderRadius: "var(--radius-sm)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: "var(--text-muted)",
                                  fontSize: 12,
                                  opacity: 0.4,
                                }}
                              >
                                —
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* VIEW LAYOUT 3: Agenda Timeline View */}
        {viewLayout === "agenda" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {displayDays.map(({ dayName, index: dayIdx }) => {
              const isToday = currentDayIndex === dayIdx;
              const daySlots = filteredSlots
                .filter((s) => s.dayOfWeek === dayIdx)
                .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));

              return (
                <div
                  key={dayName}
                  style={{
                    padding: "16px",
                    borderRadius: "var(--radius-sm)",
                    border: isToday ? `1.5px solid ${activeTheme.accent}` : `1px solid ${activeTheme.border}`,
                    background: activeTheme.cardBg,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, borderBottom: `1px solid ${activeTheme.border}`, paddingBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: isToday ? activeTheme.accent : "var(--text)" }}>{dayName} Agenda</span>
                      {isToday && <span style={{ fontSize: 10, background: activeTheme.accent, color: activeTheme.accentText, padding: "2px 6px", borderRadius: 999, fontWeight: 800 }}>TODAY</span>}
                    </div>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>{daySlots.length} class{daySlots.length === 1 ? "" : "es"}</span>
                  </div>

                  {daySlots.length === 0 ? (
                    <div style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic", opacity: 0.6 }}>No classes on {dayName}</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {daySlots.map((s) => (
                        <div
                          key={s._id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 14px",
                            borderRadius: "var(--radius-sm)",
                            background: "var(--bg-elevated)",
                            borderLeft: `4px solid ${s.subject?.color || activeTheme.accent}`,
                            gap: 12,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: activeTheme.accent, minWidth: 110, display: "flex", alignItems: "center", gap: 5 }}>
                              <Clock size={13} />
                              <span>{s.startTime} – {s.endTime}</span>
                            </div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
                              {s.subject?.name}
                            </div>
                            {showRoom && s.room && (
                              <span style={{ fontSize: 12, color: "var(--text-muted)", background: "var(--panel)", padding: "2px 8px", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <MapPin size={12} /> {s.room}
                              </span>
                            )}
                            {showClassTag && (selectedClass === "All" || s.className !== selectedClass) && (
                              <span style={{ fontSize: 10, fontWeight: 700, background: "var(--accent-soft)", color: activeTheme.accent, padding: "2px 6px", borderRadius: 4 }}>
                                {s.className || "BCA 2A"}
                              </span>
                            )}
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <button
                              type="button"
                              onClick={() => startEditSlot(s)}
                              title="Edit class slot"
                              style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeSlot(s._id)}
                              title="Remove class slot"
                              style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 📝 EDIT INDIVIDUAL SLOT MODAL ────────────────────────────────────── */}
      {editingSlot && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.7)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 480,
              padding: 24,
              borderRadius: "var(--radius-md)",
              border: `1.5px solid ${activeTheme.accent}`,
              boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Pencil size={18} style={{ color: activeTheme.accent }} />
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Edit Class Slot</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingSlot(null)}
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="label">Class / Section</label>
                <select
                  className="input"
                  style={{ width: "100%" }}
                  value={editForm.className}
                  onChange={(e) => setEditForm({ ...editForm, className: e.target.value })}
                >
                  {PRESET_CLASSES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Subject</label>
                {subjects.length > 0 ? (
                  <select
                    className="input"
                    style={{ width: "100%" }}
                    value={editForm.subjectId}
                    onChange={(e) => setEditForm({ ...editForm, subjectId: e.target.value, subjectName: "" })}
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                    <option value="NEW">+ Add new subject...</option>
                  </select>
                ) : (
                  <input
                    className="input"
                    style={{ width: "100%" }}
                    placeholder="e.g. Data Structures"
                    value={editForm.subjectName}
                    onChange={(e) => setEditForm({ ...editForm, subjectId: "NEW", subjectName: e.target.value })}
                    required
                  />
                )}
              </div>

              {subjects.length > 0 && editForm.subjectId === "NEW" && (
                <div>
                  <label className="label">New Subject Name</label>
                  <input
                    className="input"
                    style={{ width: "100%" }}
                    placeholder="Enter subject name"
                    value={editForm.subjectName}
                    onChange={(e) => setEditForm({ ...editForm, subjectName: e.target.value })}
                    required
                  />
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label className="label">Day</label>
                  <select
                    className="input"
                    style={{ width: "100%" }}
                    value={editForm.dayOfWeek}
                    onChange={(e) => setEditForm({ ...editForm, dayOfWeek: Number(e.target.value) })}
                  >
                    {DAYS.map((d, i) => (
                      <option key={d} value={i}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Start Time</label>
                  <input
                    className="input"
                    style={{ width: "100%" }}
                    type="time"
                    value={editForm.startTime}
                    onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="label">End Time</label>
                  <input
                    className="input"
                    style={{ width: "100%" }}
                    type="time"
                    value={editForm.endTime}
                    onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">Room / Lab (Optional)</label>
                <input
                  className="input"
                  style={{ width: "100%" }}
                  placeholder="e.g. Room 302 / Lab 1"
                  value={editForm.room}
                  onChange={(e) => setEditForm({ ...editForm, room: e.target.value })}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setEditingSlot(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={editSubmitting}
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <Save size={15} />
                  <span>{editSubmitting ? "Saving..." : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ⚙ CUSTOMIZER & VIEW SETTINGS TOOLBAR ────────────────────────────── */}
      {showCustomizer && (
        <div className="card" style={{ marginBottom: 24, padding: "18px 20px" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 14px 0", display: "flex", alignItems: "center", gap: 8 }}>
            <Settings size={18} style={{ color: activeTheme.accent }} /> Customize Timetable View &amp; Themes
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
            {/* Theme Customizer */}
            <div>
              <label className="label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Palette size={13} /> Color Palette Theme
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {Object.keys(THEMES).map((key) => {
                  const t = THEMES[key];
                  const isSelected = timetableTheme === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTimetableTheme(key)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "var(--radius-sm)",
                        border: isSelected ? `2px solid ${t.accent}` : "1px solid var(--border)",
                        background: isSelected ? "var(--accent-soft)" : "var(--bg-elevated)",
                        color: "var(--text)",
                        fontSize: 13,
                        fontWeight: isSelected ? 700 : 500,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>{t.name}</span>
                      <span style={{ width: 12, height: 12, borderRadius: "50%", background: t.accent, border: "1px solid rgba(255,255,255,0.3)" }} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Layout Alignment */}
            <div>
              <label className="label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Columns size={13} /> Layout Alignment
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setViewLayout("columns")}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: viewLayout === "columns" ? `2px solid ${activeTheme.accent}` : "1px solid var(--border)",
                    background: viewLayout === "columns" ? "var(--accent-soft)" : "var(--bg-elevated)",
                    color: "var(--text)",
                    fontSize: 13,
                    fontWeight: viewLayout === "columns" ? 700 : 500,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    textAlign: "left",
                  }}
                >
                  <Columns size={15} />
                  <span>Day Columns (Vertical Grid)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewLayout("matrix")}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: viewLayout === "matrix" ? `2px solid ${activeTheme.accent}` : "1px solid var(--border)",
                    background: viewLayout === "matrix" ? "var(--accent-soft)" : "var(--bg-elevated)",
                    color: "var(--text)",
                    fontSize: 13,
                    fontWeight: viewLayout === "matrix" ? 700 : 500,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    textAlign: "left",
                  }}
                >
                  <Table size={15} />
                  <span>Routine Matrix (Routine Sheet)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewLayout("agenda")}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: viewLayout === "agenda" ? `2px solid ${activeTheme.accent}` : "1px solid var(--border)",
                    background: viewLayout === "agenda" ? "var(--accent-soft)" : "var(--bg-elevated)",
                    color: "var(--text)",
                    fontSize: 13,
                    fontWeight: viewLayout === "agenda" ? 700 : 500,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    textAlign: "left",
                  }}
                >
                  <CalendarDays size={15} />
                  <span>Agenda Timeline List</span>
                </button>
              </div>
            </div>

            {/* Density & Detail Toggles */}
            <div>
              <label className="label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <SlidersHorizontal size={13} /> Density &amp; Details
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setDensity("comfortable")}
                    style={{
                      flex: 1,
                      padding: "6px",
                      borderRadius: 6,
                      border: density === "comfortable" ? `1.5px solid ${activeTheme.accent}` : "1px solid var(--border)",
                      background: density === "comfortable" ? "var(--accent-soft)" : "var(--bg-elevated)",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    Comfortable
                  </button>

                  <button
                    type="button"
                    onClick={() => setDensity("compact")}
                    style={{
                      flex: 1,
                      padding: "6px",
                      borderRadius: 6,
                      border: density === "compact" ? `1.5px solid ${activeTheme.accent}` : "1px solid var(--border)",
                      background: density === "compact" ? "var(--accent-soft)" : "var(--bg-elevated)",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    Compact
                  </button>
                </div>

                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    className="custom-checkbox"
                    checked={showRoom}
                    onChange={(e) => setShowRoom(e.target.checked)}
                  />
                  <span>Show Room / Lab Location</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    className="custom-checkbox"
                    checked={showClassTag}
                    onChange={(e) => setShowClassTag(e.target.checked)}
                  />
                  <span>Show Class / Section Badges</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Timetable Upload Section (Collapsible / Expandable) */}
      {showAiImport && (
        <form onSubmit={handleAiFormSubmit} className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <span className="label" style={{ margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                <Sparkles size={14} style={{ color: activeTheme.accent }} /> AI Auto-Import Timetable
              </span>
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0 0" }}>
                Upload a timetable image/PDF, drag &amp; drop it below, or press <kbd style={{ background: "var(--bg-elevated)", padding: "2px 5px", borderRadius: 4, border: "1px solid var(--border)", fontSize: 11 }}>Ctrl+V</kbd> anywhere to paste a screenshot!
              </p>
            </div>
            {selectedClass !== "All" && (
              <span style={{ fontSize: 11, background: "var(--accent-soft)", color: activeTheme.accent, padding: "3px 10px", borderRadius: 12, fontWeight: 600 }}>
                Targeting: {selectedClass}
              </span>
            )}
          </div>

          <FileUpload
            id="timetable-file-upload"
            accept="image/*,application/pdf"
            file={uploadFile}
            onChange={(f) => {
              setUploadFile(f);
              if (f) processImageFile(f);
            }}
            placeholder="Drag & drop your timetable photo or PDF here, or click to browse"
            helpText="Supports photo, screenshot, or PDF of your timetable. Works with Ctrl+V clipboard paste!"
          />

          {uploadError && <div className="error-text" style={{ marginTop: 10, fontSize: 13 }}>{uploadError}</div>}
          {uploadSuccess && <div style={{ marginTop: 10, fontSize: 13, color: "var(--present)", fontWeight: 600 }}>{uploadSuccess}</div>}

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <button className="btn" type="submit" disabled={uploading || !uploadFile} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {uploading ? (
                <>
                  <span className="chat-loading-dot" /> Reading timetable with AI...
                </>
              ) : (
                <>
                  <Sparkles size={15} /> Extract &amp; Add Timetable Slots
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Manual Slot Form (Collapsible / Expandable) */}
      {showAddForm && (
        <form onSubmit={addSlot} className="card" style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label className="label">Class / Year</label>
            <select
              className="input"
              value={form.className}
              onChange={(e) => setForm({ ...form, className: e.target.value })}
            >
              {PRESET_CLASSES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Subject</label>
            {subjects.length > 0 ? (
              <select
                className="input"
                value={form.subjectId}
                onChange={(e) => setForm({ ...form, subjectId: e.target.value, subjectName: "" })}
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
                <option value="NEW">+ Add new subject...</option>
              </select>
            ) : (
              <input
                className="input"
                placeholder="e.g. Data Structures"
                value={form.subjectName}
                onChange={(e) => setForm({ ...form, subjectId: "NEW", subjectName: e.target.value })}
                required
              />
            )}
          </div>

          {subjects.length > 0 && form.subjectId === "NEW" && (
            <div>
              <label className="label">New Subject Name</label>
              <input
                className="input"
                placeholder="Enter subject name"
                value={form.subjectName}
                onChange={(e) => setForm({ ...form, subjectName: e.target.value })}
                required
              />
            </div>
          )}

          <div>
            <label className="label">Day</label>
            <select className="input" value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}>
              {DAYS.map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Start</label>
            <input className="input" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
          </div>

          <div>
            <label className="label">End</label>
            <input className="input" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
          </div>

          <div>
            <label className="label">Room</label>
            <input className="input" placeholder="Optional" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
          </div>

          <button className="btn" type="submit" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> Add Class Slot
          </button>
        </form>
      )}
    </div>
  );
}

// ── Sub-component for individual Slot Card ─────────────────────────
function SlotCard({ slot, activeTheme, isCompact, showRoom, showClassTag, selectedClass, onEdit, onRemove }) {
  return (
    <div
      className="timetable-slot-card"
      style={{
        padding: isCompact ? "7px 9px" : "10px 12px",
        borderRadius: "var(--radius-sm)",
        background: "var(--bg-elevated)",
        borderLeft: `4px solid ${slot.subject?.color || activeTheme.accent}`,
        position: "relative",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 6,
          marginBottom: isCompact ? 2 : 4,
        }}
      >
        <div
          style={{
            fontSize: isCompact ? 13 : 14,
            fontWeight: 700,
            color: "var(--text)",
            lineHeight: 1.2,
            wordBreak: "break-word",
          }}
        >
          {slot.subject?.name}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
          {showClassTag && (selectedClass === "All" || slot.className !== selectedClass) && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: "2px 5px",
                borderRadius: 4,
                background: "var(--accent-soft)",
                color: activeTheme.accent,
                whiteSpace: "nowrap",
              }}
            >
              {slot.className || "BCA 2A"}
            </span>
          )}

          <button
            type="button"
            onClick={() => onEdit(slot)}
            title="Edit class slot"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 2,
              borderRadius: 4,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = activeTheme.accent; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
          >
            <Pencil size={13} />
          </button>

          <button
            type="button"
            onClick={() => onRemove(slot._id)}
            title="Remove class slot"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 2,
              borderRadius: 4,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--absent)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div
        style={{
          fontSize: isCompact ? 10 : 11,
          fontWeight: 600,
          color: "var(--text-muted)",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <Clock size={11} style={{ opacity: 0.7 }} />
        <span>{slot.startTime} – {slot.endTime}</span>
      </div>

      {showRoom && slot.room && (
        <div
          style={{
            fontSize: isCompact ? 10 : 11,
            color: activeTheme.accent,
            fontWeight: 500,
            marginTop: 2,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <MapPin size={11} style={{ opacity: 0.8 }} />
          <span>{slot.room}</span>
        </div>
      )}
    </div>
  );
}
