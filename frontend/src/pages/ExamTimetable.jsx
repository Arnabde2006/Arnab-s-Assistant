import React, { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { fileToBase64 } from "../utils/fileToBase64.js";
import FileUpload from "../components/FileUpload.jsx";

export default function ExamTimetable() {
  const [courses, setCourses] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastResult, setLastResult] = useState(null);
  const [exams, setExams] = useState([]);

  async function refresh() {
    const d = await api.get("/ai/exams");
    setExams(d.exams);
  }

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) {
      setError("Choose an image or PDF of your exam timetable first.");
      return;
    }
    setError("");
    setLoading(true);
    setLastResult(null);
    try {
      const fileBase64 = await fileToBase64(file);
      const data = await api.post("/ai/exam-timetable", {
        fileBase64,
        mimeType: file.type,
        courses,
      });
      setLastResult(data);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function removeExam(id) {
    await api.del(`/ai/exams/${id}`);
    refresh();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Exam timetable</h1>
          <p className="page-subtitle">Upload a photo or PDF — exams are auto-added to your calendar.</p>
        </div>
      </div>

      <form onSubmit={handleUpload} className="card" style={{ marginBottom: 20 }}>
        <label className="label" htmlFor="courses">Courses you're taking (optional, helps filtering)</label>
        <input
          id="courses"
          className="input"
          placeholder="e.g. Data Structures, DBMS, Operating Systems"
          value={courses}
          onChange={(e) => setCourses(e.target.value)}
          style={{ marginBottom: 16 }}
        />
        <label className="label" htmlFor="file">Timetable image or PDF</label>
        <FileUpload
          id="file"
          accept="image/*,application/pdf"
          file={file}
          onChange={setFile}
          placeholder="Drag & drop your timetable here, or click to browse"
          helpText="Supports photo or PDF of your exam timetable"
        />
        <div style={{ height: 12 }} />
        {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Reading timetable…" : "Upload & add to calendar"}
        </button>
      </form>

      {lastResult && (
        <div className="card" style={{ marginBottom: 20, borderColor: "var(--present)" }}>
          {lastResult.count > 0
            ? `Added ${lastResult.count} exam(s) to your calendar.`
            : "No exams were found on that file — try a clearer image or PDF."}
        </div>
      )}

      <div className="card">
        <div className="label" style={{ marginBottom: 12 }}>All upcoming exams</div>
        {exams.length === 0 && <div className="empty-state">No exams added yet.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {exams.map((e) => (
            <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 8, background: "var(--bg-elevated)", gap: 10, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0, flex: "1 1 160px" }}>
                <div style={{ fontWeight: 600, fontSize: 14, wordBreak: "break-word" }}>{e.course}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {e.exam_date}{e.exam_time ? ` · ${e.exam_time}` : ""}{e.notes ? ` · ${e.notes}` : ""}
                </div>
              </div>
              <button onClick={() => removeExam(e.id)} className="btn-ghost btn" style={{ fontSize: 12, padding: "6px 10px", flexShrink: 0 }}>Remove</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
