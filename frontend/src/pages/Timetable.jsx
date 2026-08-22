import React, { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "../api/client.js";
import { useLoadAnnounce } from "../context/AnnouncerContext.jsx";
import { useAsyncAction } from "../hooks/useAsyncAction.js";
import { useDialog } from "../hooks/useDialog.js";
import { fileToBase64 } from "../utils/fileToBase64.js";
import { groupConsecutiveSlots, DAYS, PRESET_CLASSES } from "../utils/timetableUtils.js";
import { useTheme } from "../context/ThemeContext.jsx";
import TimetableHeader from "../components/timetable/TimetableHeader.jsx";
import {
  TimetableColumnsView,
  TimetableMatrixView,
  TimetableAgendaView,
} from "../components/timetable/TimetableViews.jsx";
import { TimetableAddForm, TimetableEditModal } from "../components/timetable/TimetableSlotModal.jsx";
import TimetableAiModal from "../components/timetable/TimetableAiModal.jsx";
import TimetableCustomizerModal from "../components/timetable/TimetableCustomizerModal.jsx";

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
  const { theme: appTheme } = useTheme();
  const isLightMode = appTheme === "parchment";
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
    return localStorage.getItem("timetable_view_layout") || "columns";
  });

  const [timetableTheme, setTimetableTheme] = useState(() => {
    return localStorage.getItem("timetable_theme") || "ink";
  });

  const [density, setDensity] = useState(() => {
    return localStorage.getItem("timetable_density") || "comfortable";
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
    instructor: "",
    className: "BCA 2A",
  });
  const [editSubmitting, setEditSubmitting] = useState(false);

  const editDialog = useDialog(!!editingSlot, () => setEditingSlot(null));

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
    instructor: "",
  });
  const [pageLoading, setPageLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const { run, pending } = useAsyncAction();

  const currentDayIndex = new Date().getDay();

  // Sync preferences to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("timetable_selected_class", selectedClass);
    } catch {}
    if (selectedClass !== "All") {
      setForm((f) => ({ ...f, className: selectedClass }));
    }
  }, [selectedClass]);

  useEffect(() => {
    try {
      localStorage.setItem("timetable_hide_weekends", hideWeekends);
    } catch {}
  }, [hideWeekends]);

  useEffect(() => {
    try {
      localStorage.setItem("timetable_view_layout", viewLayout);
    } catch {}
  }, [viewLayout]);

  useEffect(() => {
    try {
      localStorage.setItem("timetable_theme", timetableTheme);
    } catch {}
  }, [timetableTheme]);

  useEffect(() => {
    try {
      localStorage.setItem("timetable_density", density);
    } catch {}
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
    refresh().catch((err) => setLoadError(err.message || "Couldn't load your timetable."));
  }, []);

  const startEditSlot = (slot) => {
    const realSlot =
      slot.isMerged && slot.originalSlots?.length > 0 ? slot.originalSlots[0] : slot;

    setEditingSlot({ ...realSlot, _isMergedGroup: slot.isMerged, _spanCount: slot.spanCount });
    setEditForm({
      subjectId: realSlot.subject?._id || "",
      subjectName: realSlot.subject?.name || "",
      dayOfWeek: realSlot.dayOfWeek,
      startTime: realSlot.startTime || "09:30",
      endTime: realSlot.endTime || "10:20",
      room: realSlot.room || "",
      instructor: realSlot.instructor || "",
      className: realSlot.className || selectedClass || "BCA 2A",
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
        instructor: editForm.instructor,
        className: editForm.className,
      });
      setEditingSlot(null);
      await run(refresh, { errorMessage: "Saved, but the grid may be out of date" });
    } catch (err) {
      alert(err.message || "Failed to update class slot");
    } finally {
      setEditSubmitting(false);
    }
  };

  const requestDeleteSlot = async (slotOrMerged) => {
    await removeSlot(slotOrMerged);
  };

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
          setUploadSuccess(
            `Success! Added ${data.count} class slot(s) to ${targetClass} timetable.`
          );
          setUploadFile(null);
          await run(refresh, { errorMessage: "Imported, but the grid may be out of date" });
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

  const { allClassesList, classSlotCounts } = useMemo(() => {
    const slotClasses = slots.map((s) => s.className || "BCA 2A");
    const allClassesList = Array.from(new Set([...PRESET_CLASSES, ...slotClasses]));
    const classSlotCounts = {};
    for (const cls of allClassesList) classSlotCounts[cls] = 0;
    for (const s of slots) {
      const cls = s.className || "BCA 2A";
      classSlotCounts[cls] = (classSlotCounts[cls] || 0) + 1;
    }
    return { allClassesList, classSlotCounts };
  }, [slots]);

  const filteredSlots = useMemo(() => {
    return slots.filter((s) => {
      if (selectedClass === "All") return true;
      return (s.className || "BCA 2A") === selectedClass;
    });
  }, [slots, selectedClass]);

  const displayDays = useMemo(() => {
    return DAYS.map((dayName, index) => ({ dayName, index })).filter(({ index }) => {
      if (hideWeekends) {
        return index >= 1 && index <= 5;
      }
      return true;
    });
  }, [hideWeekends]);

  const timePeriods = useMemo(() => {
    const boundarySet = new Set();
    filteredSlots.forEach((s) => {
      if (s.startTime) boundarySet.add(s.startTime.trim());
      if (s.endTime) boundarySet.add(s.endTime.trim());
    });
    const sortedBoundaries = Array.from(boundarySet).sort();

    const periods = [];
    for (let i = 0; i < sortedBoundaries.length - 1; i++) {
      const start = sortedBoundaries[i];
      const end = sortedBoundaries[i + 1];
      const isUsed = filteredSlots.some(
        (s) =>
          (s.startTime || "").trim() <= start &&
          (s.endTime || "").trim() >= end
      );
      if (isUsed) {
        periods.push({ startTime: start, endTime: end, key: `${start}-${end}` });
      }
    }
    return periods;
  }, [filteredSlots]);

  const rawTheme = THEMES[timetableTheme] || THEMES.ink;
  const activeTheme =
    isLightMode && timetableTheme === "ink"
      ? {
          ...rawTheme,
          bg: "rgba(248, 250, 255, 0.8)",
          border: "rgba(20, 23, 42, 0.12)",
          cardBg: "#ffffff",
        }
      : rawTheme;
  const isCompact = density === "compact";

  const [isMobile, setIsMobile] = React.useState(() => window.innerWidth < 768);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const effectiveLayout = isMobile ? "columns" : viewLayout;

  const activeDays = useMemo(() => {
    if (!isMobile) return displayDays;
    const todayIdx = displayDays.findIndex((d) => d.index === currentDayIndex);
    if (todayIdx <= 0) return displayDays;
    return [...displayDays.slice(todayIdx), ...displayDays.slice(0, todayIdx)];
  }, [isMobile, displayDays, currentDayIndex]);

  useLoadAnnounce(
    pageLoading,
    "Loading timetable",
    loadError ? "" : `Timetable loaded, ${slots.length} class slot${slots.length === 1 ? "" : "s"}`
  );

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
            <div
              key={n}
              className="skeleton-pulse"
              style={{ width: 90, height: 36, borderRadius: 999 }}
            />
          ))}
        </div>

        <div
          className="grid"
          style={{
            gridTemplateColumns: hideWeekends ? "repeat(5, 1fr)" : "repeat(7, 1fr)",
            gap: 12,
          }}
        >
          {displayDays.map(({ dayName }) => (
            <div key={dayName} className="card" style={{ minHeight: 180 }}>
              <div
                className="skeleton-pulse skeleton-text"
                style={{ width: "50%", height: 14, borderRadius: 4, marginBottom: 12 }}
              />
              <div
                className="skeleton-pulse skeleton-text"
                style={{ width: "90%", height: 40, borderRadius: 8, marginBottom: 8 }}
              />
              <div
                className="skeleton-pulse skeleton-text"
                style={{ width: "90%", height: 40, borderRadius: 8 }}
              />
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

    const { ok } = await run(
      () =>
        api.post("/timetable", {
          subjectId: form.subjectId === "NEW" ? "" : form.subjectId,
          subjectName: form.subjectName,
          dayOfWeek: form.dayOfWeek,
          startTime: form.startTime,
          endTime: form.endTime,
          room: form.room,
          instructor: form.instructor,
          className: form.className,
        }),
      { errorMessage: "Couldn't add that class" }
    );
    if (ok) await run(refresh, { errorMessage: "Saved, but the grid may be out of date" });
  }

  async function removeSlot(slotOrId) {
    const ids = Array.isArray(slotOrId)
      ? slotOrId
      : typeof slotOrId === "object" && slotOrId?.originalIds
      ? slotOrId.originalIds
      : typeof slotOrId === "object" && slotOrId?._id
      ? [slotOrId._id]
      : [slotOrId];

    await run(
      async () => {
        let done = 0;
        for (const id of ids) {
          try {
            await api.del(`/timetable/${id}`);
            done++;
          } catch (err) {
            if (done === 0) throw err;
            throw new Error(`only ${done} of ${ids.length} parts were removed (${err.message})`);
          }
        }
      },
      { errorMessage: "Couldn't remove that class" }
    );
    await run(refresh, { errorMessage: "The grid may be out of date" });
  }

  return (
    <div>
      <TimetableHeader
        selectedClass={selectedClass}
        setSelectedClass={setSelectedClass}
        allClassesList={allClassesList}
        classSlotCounts={classSlotCounts}
        viewLayout={viewLayout}
        setViewLayout={setViewLayout}
        timetableTheme={timetableTheme}
        setTimetableTheme={setTimetableTheme}
        THEMES={THEMES}
        density={density}
        setDensity={setDensity}
        showCustomizer={showCustomizer}
        setShowCustomizer={setShowCustomizer}
        showAiImport={showAiImport}
        setShowAiImport={setShowAiImport}
        showAddForm={showAddForm}
        setShowAddForm={setShowAddForm}
        isMobile={isMobile}
      />

      {loadError && (
        <div className="load-error" role="alert">
          <span>{loadError}</span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              setLoadError("");
              refresh().catch((err) => setLoadError(err.message || "Couldn't load your timetable."));
            }}
          >
            Retry
          </button>
        </div>
      )}

      <TimetableCustomizerModal
        showCustomizer={showCustomizer}
        setShowCustomizer={setShowCustomizer}
        showRoom={showRoom}
        setShowRoom={setShowRoom}
        showClassTag={showClassTag}
        setShowClassTag={setShowClassTag}
        hideWeekends={hideWeekends}
        setHideWeekends={setHideWeekends}
        timetableTheme={timetableTheme}
        setTimetableTheme={setTimetableTheme}
        density={density}
        setDensity={setDensity}
        THEMES={THEMES}
      />

      <TimetableAiModal
        showAiImport={showAiImport}
        setShowAiImport={setShowAiImport}
        selectedClass={selectedClass}
        uploadFile={uploadFile}
        setUploadFile={setUploadFile}
        uploading={uploading}
        uploadError={uploadError}
        uploadSuccess={uploadSuccess}
        handleAiFormSubmit={handleAiFormSubmit}
      />

      <TimetableAddForm
        showAddForm={showAddForm}
        form={form}
        setForm={setForm}
        subjects={subjects}
        addSlot={addSlot}
        pending={pending}
      />

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
        {effectiveLayout === "columns" && (
          <TimetableColumnsView
            activeDays={activeDays}
            currentDayIndex={currentDayIndex}
            filteredSlots={filteredSlots}
            activeTheme={activeTheme}
            isCompact={isCompact}
            isMobile={isMobile}
            hideWeekends={hideWeekends}
            showRoom={showRoom}
            showClassTag={showClassTag}
            selectedClass={selectedClass}
            onEdit={startEditSlot}
            onRemove={requestDeleteSlot}
          />
        )}

        {effectiveLayout === "matrix" && (
          <TimetableMatrixView
            activeDays={activeDays}
            currentDayIndex={currentDayIndex}
            filteredSlots={filteredSlots}
            timePeriods={timePeriods}
            activeTheme={activeTheme}
            showRoom={showRoom}
            showClassTag={showClassTag}
            selectedClass={selectedClass}
            onEdit={startEditSlot}
            onRemove={requestDeleteSlot}
          />
        )}

        {effectiveLayout === "agenda" && (
          <TimetableAgendaView
            activeDays={activeDays}
            currentDayIndex={currentDayIndex}
            filteredSlots={filteredSlots}
            activeTheme={activeTheme}
            showRoom={showRoom}
            showClassTag={showClassTag}
            selectedClass={selectedClass}
            onEdit={startEditSlot}
            onRemove={requestDeleteSlot}
          />
        )}
      </div>

      <TimetableEditModal
        editingSlot={editingSlot}
        setEditingSlot={setEditingSlot}
        editForm={editForm}
        setEditForm={setEditForm}
        editSubmitting={editSubmitting}
        handleEditSubmit={handleEditSubmit}
        subjects={subjects}
        editDialog={editDialog}
      />
    </div>
  );
}
