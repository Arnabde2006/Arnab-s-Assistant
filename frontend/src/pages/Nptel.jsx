import React, { useEffect, useState } from "react";
import { api } from "../api/client.js";
import {
  Award,
  BookOpen,
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Upload,
  Sparkles,
  CheckCircle2,
  Clock
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

export default function Nptel() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCourseId, setExpandedCourseId] = useState(null);
  
  // Modal & Upload states
  const [uploading, setUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    course_name: "",
    duration_weeks: 8,
    start_date: toISO(new Date()),
    assignment_due_day: 3, // Wednesday default
    exam_date: "",
  });
  const [formError, setFormError] = useState("");

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

  const openAddModal = () => {
    setFormData({
      course_name: "",
      duration_weeks: 8,
      start_date: toISO(new Date()),
      assignment_due_day: 3,
      exam_date: "",
    });
    setFormError("");
    setShowModal(true);
  };

  const handleScheduleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result.split(",")[1];
        try {
          const res = await api.post("/nptel/parse-schedule", {
            fileBase64: base64Data,
            mimeType: file.type,
          });

          if (res.extracted) {
            const ext = res.extracted;
            setFormData({
              course_name: ext.course_name || "NPTEL Course",
              duration_weeks: ext.duration_weeks || 8,
              start_date: ext.start_date || toISO(new Date()),
              assignment_due_day: 3,
              exam_date: ext.exam_date || "",
            });
            setFormError("");
            setShowModal(true);
          }
        } catch (err) {
          alert(err.message || "Failed to parse NPTEL schedule from image.");
        } finally {
          setUploading(false);
          e.target.value = "";
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setUploading(false);
    }
  };

  const handleSaveCourse = async (e) => {
    e.preventDefault();
    if (!formData.course_name.trim()) {
      setFormError("Course name is required.");
      return;
    }

    try {
      await api.post("/nptel", formData);
      setShowModal(false);
      loadNptelData();
    } catch (err) {
      setFormError(err.message || "Failed to save NPTEL course");
    }
  };

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

  const handleDeleteCourse = async (courseId) => {
    if (!confirm("Are you sure you want to delete this NPTEL course and all its assignment trackers?")) return;
    try {
      await api.del(`/nptel/${courseId}`);
      loadNptelData();
    } catch (err) {
      alert(err.message || "Failed to delete course");
    }
  };

  // Metrics
  const totalAssignments = courses.reduce((sum, c) => sum + (c.totalAssignments || 0), 0);
  const totalSubmitted = courses.reduce((sum, c) => sum + (c.submittedCount || 0), 0);
  const overallProgress = totalAssignments > 0 ? Math.round((totalSubmitted / totalAssignments) * 100) : 0;

  const todayStr = toISO(new Date());
  const upcomingAssignments = courses.flatMap((c) => c.assignments || []).filter((a) => !a.submitted && a.due_date >= todayStr);

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", paddingBottom: 40 }}>
      {/* Header */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Award className="icon" size={28} /> NPTEL Courses &amp; Assignments
          </h1>
          <p className="page-subtitle">
            Track weekly assignment submission deadlines, proctored exams, and certificate progress.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label className="btn-ghost btn" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Upload size={16} />
            {uploading ? "AI Reading Schedule..." : "Upload Syllabus / Schedule"}
            <input
              type="file"
              accept="image/*,application/pdf"
              style={{ display: "none" }}
              onChange={handleScheduleUpload}
              disabled={uploading}
            />
          </label>

          <button className="btn" onClick={openAddModal} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Plus size={16} /> Add NPTEL Course
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="label">Enrolled Courses</div>
          <div className="stat-num">
            {courses.length}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            Active NPTEL certifications
          </div>
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

      {/* Loading Skeleton */}
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[1, 2].map((n) => (
            <div key={n} className="card skeleton-pulse" style={{ height: 120, borderRadius: 12 }} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && courses.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
          <Award size={40} style={{ color: "var(--text-muted)", marginBottom: 12 }} />
          <h3 style={{ margin: "0 0 6px 0", fontSize: 16 }}>No NPTEL courses added yet</h3>
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
            Click "Add NPTEL Course" or upload a schedule screenshot to auto-generate weekly assignment reminders on your calendar!
          </p>
        </div>
      )}

      {/* Courses List */}
      {!loading && courses.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {courses.map((course) => {
            const isExpanded = expandedCourseId === course.id;
            return (
              <div key={course.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
                {/* Course Header */}
                <div
                  style={{
                    padding: "16px 20px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    background: "var(--bg-elevated)",
                    borderBottom: isExpanded ? "1px solid var(--border-color)" : "none",
                  }}
                  onClick={() => setExpandedCourseId(isExpanded ? null : course.id)}
                >
                  <div style={{ flex: 1, paddingRight: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{course.course_name}</h3>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 12,
                          background: "rgba(59, 130, 246, 0.15)",
                          color: "#3b82f6",
                        }}
                      >
                        {course.duration_weeks}-Week Course
                      </span>

                      {course.exam_date && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: 12,
                            background: "rgba(234, 179, 8, 0.15)",
                            color: "var(--warning)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Calendar size={12} /> Exam: {formatDateDisplay(course.exam_date)}
                        </span>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ flex: 1, maxWidth: 300, height: 6, borderRadius: 3, background: "var(--border-color)", overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${course.progress}%`,
                            height: "100%",
                            background: course.progress === 100 ? "var(--present)" : "var(--primary-color)",
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                        {course.submittedCount} / {course.totalAssignments} Assignments ({course.progress}%)
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12 }} onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn btn-ghost"
                      onClick={() => handleDeleteCourse(course.id)}
                      style={{ padding: 6, color: "var(--text-muted)" }}
                      title="Delete Course"
                    >
                      <Trash2 size={16} />
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() => setExpandedCourseId(isExpanded ? null : course.id)}
                      style={{ padding: 6 }}
                    >
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                  </div>
                </div>

                {/* Expanded Weekly Assignment List */}
                {isExpanded && (
                  <div style={{ padding: "16px 20px" }}>
                    <h4 style={{ margin: "0 0 12px 0", fontSize: 14, color: "var(--text-muted)", fontWeight: 600 }}>
                      Weekly Assignment Submission Checklist
                    </h4>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {course.assignments && course.assignments.map((assignment) => {
                        const isPastDue = !assignment.submitted && assignment.due_date < todayStr;
                        return (
                          <div
                            key={assignment.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "10px 14px",
                              borderRadius: 8,
                              background: assignment.submitted
                                ? "rgba(34, 197, 94, 0.08)"
                                : isPastDue
                                ? "rgba(239, 68, 68, 0.08)"
                                : "var(--bg-secondary)",
                              border: assignment.submitted
                                ? "1px solid rgba(34, 197, 94, 0.2)"
                                : isPastDue
                                ? "1px solid rgba(239, 68, 68, 0.2)"
                                : "1px solid var(--border-color)",
                              flexWrap: "wrap",
                              gap: 10,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 220 }}>
                              <input
                                type="checkbox"
                                className="custom-checkbox"
                                checked={assignment.submitted}
                                onChange={() => toggleAssignmentSubmitted(assignment)}
                              />
                              <div>
                                <div style={{ fontSize: 14, fontWeight: 600, textDecoration: assignment.submitted ? "line-through" : "none" }}>
                                  {assignment.title}
                                </div>
                                <div style={{ fontSize: 12, color: isPastDue ? "#ef4444" : "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                                  <Clock size={12} /> Due: {formatDateDisplay(assignment.due_date)}
                                  {isPastDue && <strong style={{ marginLeft: 4 }}>(Overdue!)</strong>}
                                </div>
                              </div>
                            </div>

                            {/* Score Input */}
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
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
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add NPTEL Course Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.6)",
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
              maxHeight: "90vh",
              overflowY: "auto",
              position: "relative",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Add NPTEL Course</h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: "none", border: "none", fontSize: 20, color: "var(--text-muted)", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {formError && (
              <div style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveCourse} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  NPTEL Course Name *
                </label>
                <input
                  className="input"
                  placeholder="e.g. Programming in Java, Data Structures"
                  value={formData.course_name}
                  onChange={(e) => setFormData({ ...formData, course_name: e.target.value })}
                  required
                />
              </div>

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

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button type="button" className="btn-ghost btn" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn">
                  Create Course &amp; Generate Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
