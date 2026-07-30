import React, { useEffect, useState, useRef, useCallback } from "react";
import { api } from "../api/client.js";
import {
  Award,
  Calendar,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Sparkles,
  Clock,
  Pencil,
  ImageIcon,
  Loader2,
  CheckCircle2,
  ListFilter,
  Camera,
  GripVertical,
} from "lucide-react";

function pad(n) {
  return String(n).padStart(2, "0");
}

function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const INITIAL_FORM = {
  course_name: "",
  duration_weeks: 12,
  start_date: toISO(new Date()),
  assignment_due_day: 3,
  exam_date: "",
};

export default function Nptel() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCourseId, setExpandedCourseId] = useState(null);

  // Filter state for assignments: "all" | "pending" | "submitted"
  const [assignmentFilter, setAssignmentFilter] = useState("all");

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState("");

  // Upload / AI states
  const [uploading, setUploading] = useState(false);
  const [aiLookupLoading, setAiLookupLoading] = useState(false);
  const [aiLookupMsg, setAiLookupMsg] = useState("");

  // Drag & Drop File Upload
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Drag & Drop Course Reordering
  const [draggedCourseIndex, setDraggedCourseIndex] = useState(null);
  const [dragOverCourseIndex, setDragOverCourseIndex] = useState(null);

  const saveCourseOrder = async (updatedCourses) => {
    setCourses(updatedCourses);
    try {
      const courseIds = updatedCourses.map((c) => c.id);
      await api.put("/nptel/reorder", { courseIds });
    } catch (err) {
      console.error("Failed to save course order:", err);
    }
  };

  const handleMoveCourse = (index, direction, e) => {
    if (e) e.stopPropagation();
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= courses.length) return;

    const updated = [...courses];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    saveCourseOrder(updated);
  };

  const handleCourseDragStart = (e, index) => {
    setDraggedCourseIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };

  const handleCourseDragOver = (e, index) => {
    e.preventDefault();
    if (draggedCourseIndex === null || draggedCourseIndex === index) return;
    setDragOverCourseIndex(index);
  };

  const handleCourseDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedCourseIndex === null || draggedCourseIndex === targetIndex) {
      setDraggedCourseIndex(null);
      setDragOverCourseIndex(null);
      return;
    }
    const updated = [...courses];
    const [moved] = updated.splice(draggedCourseIndex, 1);
    updated.splice(targetIndex, 0, moved);

    setDraggedCourseIndex(null);
    setDragOverCourseIndex(null);
    saveCourseOrder(updated);
  };

  const handleCourseDragEnd = () => {
    setDraggedCourseIndex(null);
    setDragOverCourseIndex(null);
  };

  // ── Data loading ──────────────────────────────────────────────────
  async function loadNptelData() {
    try {
      setLoading(true);
      const data = await api.get("/nptel");
      setCourses(data.courses || []);
      if (data.courses?.length > 0 && !expandedCourseId) {
        setExpandedCourseId(data.courses[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNptelData();
  }, []);

  // ── Clipboard Paste ───────────────────────────────────────────────
  const handleClipboardPaste = useCallback(
    (e) => {
      if (showModal) return; // don't intercept while modal is open
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) processImageFile(file);
          break;
        }
      }
    },
    [showModal]
  );

  useEffect(() => {
    window.addEventListener("paste", handleClipboardPaste);
    return () => window.removeEventListener("paste", handleClipboardPaste);
  }, [handleClipboardPaste]);

  // ── Core image processing (shared by upload, drag-drop, paste) ────
  async function processImageFile(file) {
    try {
      setUploading(true);
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result.split(",")[1];
        try {
          const res = await api.post("/nptel/parse-schedule", {
            fileBase64: base64Data,
            mimeType: file.type || "image/png",
          });
          if (res.extracted) {
            const ext = res.extracted;
            const extractedName = ext.course_name || "NPTEL Course";

            // Match against existing course to prevent duplicates
            const match = courses.find(
              (c) =>
                c.course_name.trim().toLowerCase() === extractedName.trim().toLowerCase() ||
                c.course_name.trim().toLowerCase().includes(extractedName.trim().toLowerCase()) ||
                extractedName.trim().toLowerCase().includes(c.course_name.trim().toLowerCase())
            );

            if (match) {
              setEditingCourse(match);
              setFormData({
                course_name: match.course_name,
                duration_weeks: ext.duration_weeks || match.duration_weeks,
                start_date: ext.start_date || toISO(new Date(match.start_date)),
                assignment_due_day: match.assignment_due_day || 3,
                exam_date: ext.exam_date || (match.exam_date ? toISO(new Date(match.exam_date)) : ""),
              });
              setAiLookupMsg(`✓ Matched existing course "${match.course_name}". Saving will update it without duplicating!`);
            } else {
              setEditingCourse(null);
              setFormData({
                course_name: extractedName,
                duration_weeks: ext.duration_weeks || 12,
                start_date: ext.start_date || toISO(new Date()),
                assignment_due_day: 3,
                exam_date: ext.exam_date || "",
              });
              setAiLookupMsg("");
            }

            setFormError("");
            setShowModal(true);
          }
        } catch (err) {
          alert(err.message || "Failed to parse NPTEL schedule from image.");
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setUploading(false);
    }
  }

  const handleScheduleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processImageFile(file);
    e.target.value = "";
  };

  // ── Drag & Drop ───────────────────────────────────────────────────
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith("image/") || file.type === "application/pdf")) {
      processImageFile(file);
    }
  };

  // ── AI Autofill by course name ────────────────────────────────────
  const handleAILookup = async () => {
    const name = formData.course_name.trim();
    if (!name) {
      setFormError("Enter a course name first.");
      return;
    }
    try {
      setAiLookupLoading(true);
      setAiLookupMsg("");
      setFormError("");
      const res = await api.post("/nptel/lookup-course", { courseName: name });
      if (res.course) {
        const c = res.course;
        setFormData((prev) => ({
          ...prev,
          course_name: c.course_name || prev.course_name,
          duration_weeks: c.duration_weeks || prev.duration_weeks,
          start_date: c.start_date || prev.start_date,
          exam_date: c.exam_date || "",
        }));
        setAiLookupMsg(c.description ? `✓ ${c.description}` : "✓ AI filled in course details!");
      }
    } catch (err) {
      setFormError(err.message || "AI lookup failed. Please fill in details manually.");
    } finally {
      setAiLookupLoading(false);
    }
  };

  // ── Modal helpers ─────────────────────────────────────────────────
  const openAddModal = () => {
    setEditingCourse(null);
    setFormData(INITIAL_FORM);
    setFormError("");
    setAiLookupMsg("");
    setShowModal(true);
  };

  const openEditModal = (course, e) => {
    e.stopPropagation();
    setEditingCourse(course);
    setFormData({
      course_name: course.course_name,
      duration_weeks: course.duration_weeks,
      start_date: toISO(new Date(course.start_date)),
      assignment_due_day: course.assignment_due_day,
      exam_date: course.exam_date ? toISO(new Date(course.exam_date)) : "",
    });
    setFormError("");
    setAiLookupMsg("");
    setShowModal(true);
  };

  const handleSaveCourse = async (e) => {
    e.preventDefault();
    if (!formData.course_name.trim()) {
      setFormError("Course name is required.");
      return;
    }
    try {
      if (editingCourse) {
        await api.put(`/nptel/${editingCourse.id}`, formData);
      } else {
        await api.post("/nptel", formData);
      }
      setShowModal(false);
      loadNptelData();
    } catch (err) {
      setFormError(err.message || "Failed to save NPTEL course");
    }
  };

  // ── Assignment actions ────────────────────────────────────────────
  const toggleAssignmentSubmitted = async (assignment) => {
    try {
      await api.put(`/nptel/assignments/${assignment.id}`, {
        submitted: !assignment.submitted,
      });
      loadNptelData();
    } catch (err) {
      alert(err.message || "Failed to update assignment status");
    }
  };

  const handleScoreChange = async (assignment, newScore) => {
    try {
      await api.put(`/nptel/assignments/${assignment.id}`, {
        score: newScore === "" ? null : Number(newScore),
      });
      loadNptelData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCourse = async (courseId, e) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this NPTEL course and all its assignment trackers?")) return;
    try {
      await api.del(`/nptel/${courseId}`);
      loadNptelData();
    } catch (err) {
      alert(err.message || "Failed to delete course");
    }
  };

  // ── Metrics ───────────────────────────────────────────────────────
  const totalAssignments = courses.reduce((sum, c) => sum + (c.totalAssignments || 0), 0);
  const totalSubmitted = courses.reduce((sum, c) => sum + (c.submittedCount || 0), 0);
  const overallProgress = totalAssignments > 0 ? Math.round((totalSubmitted / totalAssignments) * 100) : 0;
  const todayStr = toISO(new Date());
  const upcomingAssignments = courses
    .flatMap((c) => c.assignments || [])
    .filter((a) => !a.submitted && a.due_date >= todayStr)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", paddingBottom: 40 }}>
      {/* ── Page Header ── */}
      <div
        className="page-header"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}
      >
        <div>
          <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Award className="icon" size={28} /> NPTEL Courses &amp; Assignments
          </h1>
          <p className="page-subtitle">
            Track weekly assignment submission deadlines, proctored exams, and certificate progress.
          </p>
        </div>
        <button className="btn" onClick={openAddModal} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Plus size={16} /> Add NPTEL Course
        </button>
      </div>

      {/* ── Metric Cards ── */}
      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="label">Enrolled Courses</div>
          <div className="stat-num">{courses.length}</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Active NPTEL certifications</div>
        </div>
        <div className="card">
          <div className="label">Overall Assignment Progress</div>
          <div className="stat-num" style={{ color: overallProgress >= 75 ? "var(--present)" : "var(--accent)" }}>
            {overallProgress}%
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            {totalSubmitted} of {totalAssignments} weekly assignments submitted
          </div>
        </div>
        <div className="card">
          <div className="label">Pending Upcoming Due Dates</div>
          <div className="stat-num" style={{ color: upcomingAssignments.length > 0 ? "var(--urgent)" : "var(--text)" }}>
            {upcomingAssignments.length}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            Next due: {upcomingAssignments.length > 0 ? formatDateDisplay(upcomingAssignments[0].due_date) : "None"}
          </div>
        </div>
      </div>

      {/* ── Drag & Drop / Mobile Photo Upload Hero ── */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragOver ? "var(--accent)" : "var(--border)"}`,
          borderRadius: 14,
          padding: "20px 18px",
          textAlign: "center",
          cursor: uploading ? "wait" : "pointer",
          marginBottom: 24,
          background: isDragOver ? "var(--accent-soft)" : "var(--bg-elevated)",
          transition: "all 0.2s ease",
          transform: isDragOver ? "scale(1.015)" : "scale(1)",
          boxShadow: isDragOver ? "0 0 0 3px var(--accent-soft)" : "none",
          position: "relative",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          style={{ display: "none" }}
          onChange={handleScheduleUpload}
          disabled={uploading}
        />

        {uploading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--accent)" }}>
            <Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: 15, fontWeight: 600 }}>AI is reading your schedule…</span>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 6 }}>
              <Camera size={22} style={{ color: "var(--accent)" }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
                {isDragOver ? "Drop schedule photo to extract ✨" : "Scan or Upload Schedule Screenshot"}
              </span>
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
              Tap to choose photo or screenshot · drag &amp; drop on desktop ·{" "}
              <kbd style={{ fontSize: 11, padding: "1px 5px", borderRadius: 4, background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                Ctrl+V
              </kbd>{" "}
              paste
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
              <Sparkles size={11} style={{ color: "var(--accent)" }} />
              AI auto-extracts course name, duration &amp; weekly due dates
            </div>
          </>
        )}
      </div>

      {/* ── Loading Skeleton ── */}
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[1, 2].map((n) => (
            <div key={n} className="card skeleton-pulse" style={{ height: 120, borderRadius: 12 }} />
          ))}
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && courses.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
          <Award size={40} style={{ color: "var(--text-muted)", marginBottom: 12 }} />
          <h3 style={{ margin: "0 0 6px 0", fontSize: 16 }}>No NPTEL courses added yet</h3>
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
            Upload a schedule photo above, press{" "}
            <kbd style={{ fontSize: 11, padding: "1px 5px", borderRadius: 4, background: "var(--bg-elevated)", border: "1px solid var(--border-color)" }}>
              Ctrl+V
            </kbd>
            , or tap <strong>Add NPTEL Course</strong> and use AI Autofill!
          </p>
        </div>
      )}

      {/* ── Courses List ── */}
      {!loading && courses.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {courses.map((course, index) => {
            const isExpanded = expandedCourseId === course.id;
            const isDragging = draggedCourseIndex === index;
            const isDragTarget = dragOverCourseIndex === index;

            // Filter assignments for this course
            const rawAssignments = course.assignments || [];
            const filteredAssignments = rawAssignments.filter((a) => {
              if (assignmentFilter === "pending") return !a.submitted;
              if (assignmentFilter === "submitted") return a.submitted;
              return true; // "all"
            });

            const pendingCount = rawAssignments.filter((a) => !a.submitted).length;
            const submittedCount = rawAssignments.filter((a) => a.submitted).length;

            return (
              <div
                key={course.id}
                className="card nptel-course-card"
                draggable
                onDragStart={(e) => handleCourseDragStart(e, index)}
                onDragOver={(e) => handleCourseDragOver(e, index)}
                onDrop={(e) => handleCourseDrop(e, index)}
                onDragEnd={handleCourseDragEnd}
                style={{
                  padding: 0,
                  overflow: "hidden",
                  position: "relative",
                  opacity: isDragging ? 0.45 : 1,
                  boxShadow: isDragTarget ? "0 0 0 2px var(--accent), 0 8px 24px rgba(99,102,241,0.2)" : undefined,
                  transform: isDragTarget ? "scale(1.01)" : "scale(1)",
                  transition: "all 0.15s ease",
                }}
              >
                {/* ── Responsive Course Header ── */}
                <div
                  style={{
                    padding: "16px 20px",
                    background: "var(--bg-elevated)",
                    borderBottom: isExpanded ? "1px solid var(--border-color)" : "none",
                    cursor: "pointer",
                    position: "relative",
                  }}
                  onClick={() => setExpandedCourseId(isExpanded ? null : course.id)}
                >
                  <div className="nptel-course-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div className="nptel-course-title-box" style={{ flex: 1, display: "flex", alignItems: "flex-start", gap: 8 }}>
                      {/* Drag Handle & Mobile Reorder Controls */}
                      <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0, marginTop: 1 }}>
                        <span
                          className="nptel-drag-handle"
                          title="Drag to reorder courses"
                          style={{
                            color: "var(--accent)",
                            background: "var(--accent-soft)",
                            padding: "4px 4px",
                            borderRadius: 6,
                            cursor: "grab",
                            display: "inline-flex",
                            alignItems: "center",
                            justify: "center",
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <GripVertical size={16} />
                        </span>

                        {courses.length > 1 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 0 }} onClick={(e) => e.stopPropagation()}>
                            {index > 0 && (
                              <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={(e) => handleMoveCourse(index, -1, e)}
                                style={{ padding: "1px 2px", height: "auto", minHeight: 0, color: "var(--text-muted)" }}
                                title="Move Up"
                              >
                                <ChevronUp size={12} />
                              </button>
                            )}
                            {index < courses.length - 1 && (
                              <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={(e) => handleMoveCourse(index, 1, e)}
                                style={{ padding: "1px 2px", height: "auto", minHeight: 0, color: "var(--text-muted)" }}
                                title="Move Down"
                              >
                                <ChevronDown size={12} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 className="nptel-course-title">{course.course_name}</h3>

                        <div className="nptel-course-badges" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span
                            style={{
                              fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 12,
                              background: "rgba(59,130,246,0.15)", color: "#3b82f6",
                            }}
                          >
                            {course.duration_weeks}-Week Course
                          </span>
                          {course.exam_date && (
                            <span
                              style={{
                                fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 12,
                                background: "rgba(234,179,8,0.15)", color: "var(--warning)",
                                display: "inline-flex", alignItems: "center", gap: 4,
                              }}
                            >
                              <Calendar size={11} /> Exam: {formatDateDisplay(course.exam_date)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="nptel-course-header-actions" style={{ display: "flex", alignItems: "center", gap: 2 }} onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn btn-ghost"
                        onClick={(e) => openEditModal(course, e)}
                        style={{ padding: "6px 8px", color: "var(--text-muted)" }}
                        title="Edit Course"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="btn btn-ghost"
                        onClick={(e) => handleDeleteCourse(course.id, e)}
                        style={{ padding: "6px 8px", color: "var(--text-muted)" }}
                        title="Delete Course"
                      >
                        <Trash2 size={15} />
                      </button>
                      <button
                        className="btn btn-ghost"
                        onClick={() => setExpandedCourseId(isExpanded ? null : course.id)}
                        style={{ padding: "6px 8px" }}
                      >
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Full-width Progress Bar */}
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
                        {course.submittedCount} of {course.totalAssignments} assignments submitted
                      </span>
                      <span
                        style={{
                          fontSize: 12, fontWeight: 700,
                          color:
                            course.progress === 100
                              ? "var(--present)"
                              : course.progress >= 50
                              ? "var(--accent)"
                              : "var(--text-muted)",
                        }}
                      >
                        {course.progress}%
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${course.progress}%`,
                          height: "100%",
                          borderRadius: 3,
                          background: course.progress === 100 ? "var(--present)" : "var(--accent)",
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* ── Expanded Assignment Checklist with Quick Filters ── */}
                {isExpanded && (
                  <div style={{ padding: "16px 20px" }}>
                    {/* Header + Filter Pills */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                        <ListFilter size={15} /> Assignment Checklist
                      </div>

                      {/* Filter Chips */}
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className={`nptel-filter-chip ${assignmentFilter === "all" ? "active" : ""}`}
                          onClick={() => setAssignmentFilter("all")}
                        >
                          All ({rawAssignments.length})
                        </button>
                        <button
                          className={`nptel-filter-chip ${assignmentFilter === "pending" ? "active" : ""}`}
                          onClick={() => setAssignmentFilter("pending")}
                        >
                          Pending ({pendingCount})
                        </button>
                        <button
                          className={`nptel-filter-chip ${assignmentFilter === "submitted" ? "active" : ""}`}
                          onClick={() => setAssignmentFilter("submitted")}
                        >
                          Submitted ({submittedCount})
                        </button>
                      </div>
                    </div>

                    {/* Filtered Assignment Rows */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {filteredAssignments.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "16px 0", color: "var(--text-muted)", fontSize: 13 }}>
                          No {assignmentFilter} assignments found.
                        </div>
                      ) : (
                        filteredAssignments.map((assignment) => {
                          const isPastDue = !assignment.submitted && assignment.due_date < todayStr;
                          const borderColor = assignment.submitted
                            ? "var(--present)"
                            : isPastDue
                            ? "#ef4444"
                            : "var(--accent)";

                          return (
                            <div
                              key={assignment.id}
                              className="nptel-assignment-row"
                              style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "10px 14px", borderRadius: 8, gap: 10,
                                background: assignment.submitted
                                  ? "rgba(34,197,94,0.06)"
                                  : isPastDue
                                  ? "rgba(239,68,68,0.06)"
                                  : "var(--bg-secondary)",
                                border: "1px solid var(--border-color)",
                                borderLeft: `4px solid ${borderColor}`,
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 200 }}>
                                <input
                                  type="checkbox"
                                  className="custom-checkbox"
                                  checked={assignment.submitted}
                                  onChange={() => toggleAssignmentSubmitted(assignment)}
                                  style={{ width: 18, height: 18, cursor: "pointer" }}
                                />
                                <div>
                                  <div style={{ fontSize: 14, fontWeight: 600, textDecoration: assignment.submitted ? "line-through" : "none" }}>
                                    {assignment.title}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 12, color: isPastDue ? "#ef4444" : "var(--text-muted)",
                                      display: "flex", alignItems: "center", gap: 4, marginTop: 2,
                                    }}
                                  >
                                    <Clock size={12} /> Due: {formatDateDisplay(assignment.due_date)}
                                    {isPastDue && <strong style={{ marginLeft: 4 }}>(Overdue!)</strong>}
                                  </div>
                                </div>
                              </div>

                              <div className="nptel-assignment-score-box" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Score / Marks:</span>
                                <input
                                  className="input"
                                  type="number"
                                  placeholder="e.g. 90"
                                  value={assignment.score !== null && assignment.score !== undefined ? assignment.score : ""}
                                  onChange={(e) => handleScoreChange(assignment, e.target.value)}
                                  style={{ width: 75, padding: "4px 8px", fontSize: 13, height: 32 }}
                                />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add / Edit NPTEL Course Modal (Responsive Bottom Sheet on Mobile) ── */}
      {showModal && (
        <div
          className="nptel-modal-overlay"
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center",
            justifyContent: "center", zIndex: 1000, padding: 16,
          }}
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div
            className="card nptel-modal-content"
            style={{
              width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto",
              position: "relative", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.3)",
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                {editingCourse ? "✏️ Edit NPTEL Course" : "Add NPTEL Course"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: "none", border: "none", fontSize: 20, color: "var(--text-muted)", cursor: "pointer", padding: 4 }}
              >
                ✕
              </button>
            </div>

            {/* Alerts */}
            {formError && (
              <div style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
                {formError}
              </div>
            )}
            {aiLookupMsg && (
              <div
                style={{
                  background: "rgba(34,197,94,0.12)", color: "var(--present)",
                  padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12,
                  display: "flex", alignItems: "flex-start", gap: 6,
                }}
              >
                <Sparkles size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                <span>{aiLookupMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveCourse} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Course Name + AI Autofill */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  NPTEL Course Name *
                </label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input
                    className="input"
                    placeholder="e.g. Programming in Java"
                    value={formData.course_name}
                    onChange={(e) => { setFormData({ ...formData, course_name: e.target.value }); setAiLookupMsg(""); }}
                    required
                    style={{ flex: 1, minWidth: 200 }}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={handleAILookup}
                    disabled={aiLookupLoading || !formData.course_name.trim()}
                    title="Let AI fill in course details from the name"
                    style={{
                      whiteSpace: "nowrap", display: "inline-flex", alignItems: "center",
                      gap: 6, padding: "0 12px", fontSize: 13, height: 38,
                    }}
                  >
                    {aiLookupLoading ? (
                      <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    {aiLookupLoading ? "Looking up…" : "AI Autofill"}
                  </button>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  Type any NPTEL course name and tap <strong>AI Autofill</strong> to infer duration &amp; exam dates.
                </div>
              </div>

              {/* Duration + Due Day */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                    Course Duration
                  </label>
                  <select
                    className="input"
                    value={formData.duration_weeks}
                    onChange={(e) => setFormData({ ...formData, duration_weeks: Number(e.target.value) })}
                  >
                    <option value={4}>4-Week Course</option>
                    <option value={8}>8-Week Course</option>
                    <option value={12}>12-Week Course</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                    Assignment Due Day
                  </label>
                  <select
                    className="input"
                    value={formData.assignment_due_day}
                    onChange={(e) => setFormData({ ...formData, assignment_due_day: Number(e.target.value) })}
                  >
                    <option value={3}>Wednesday (Default)</option>
                    <option value={1}>Monday</option>
                    <option value={2}>Tuesday</option>
                    <option value={4}>Thursday</option>
                    <option value={5}>Friday</option>
                    <option value={6}>Saturday</option>
                    <option value={0}>Sunday</option>
                  </select>
                </div>
              </div>

              {/* Start Date */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  Course Start Date *
                </label>
                <input
                  className="input"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  required
                />
              </div>

              {/* Exam Date */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  Proctored Exam Date (Optional)
                </label>
                <input
                  className="input"
                  type="date"
                  value={formData.exam_date}
                  onChange={(e) => setFormData({ ...formData, exam_date: e.target.value })}
                />
              </div>

              {/* Edit warning */}
              {editingCourse && (
                <div
                  style={{
                    fontSize: 12, color: "var(--text-muted)", background: "var(--bg-secondary)",
                    padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)",
                  }}
                >
                  ℹ️ Changing the start date, duration, or due day will regenerate assignment dates.
                  Already-submitted assignments will be preserved by week number.
                </div>
              )}

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
                <button type="button" className="btn-ghost btn" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn">
                  {editingCourse ? "Save Changes" : "Create Course & Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
