import React, { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { fileToBase64 } from "../utils/fileToBase64.js";
import FileUpload from "../components/FileUpload.jsx";

export default function Grades() {
  const [semester, setSemester] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState({ semesters: [], cgpa: 0, totalCredits: 0 });

  async function refresh() {
    try {
      const d = await api.get("/ai/grades");
      setData(d);
    } finally {
      setPageLoading(false);
    }
  }

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file || !semester.trim()) {
      setError("Enter a semester label and choose a file first.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const fileBase64 = await fileToBase64(file);
      const result = await api.post("/ai/grade-card", {
        fileBase64,
        mimeType: file.type,
        semester: semester.trim(),
      });
      setData(result);
      setFile(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function removeSemester(sem) {
    const result = await api.del(`/ai/grades/${encodeURIComponent(sem)}`);
    setData(result);
  }

  if (pageLoading) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Grades</h1>
            <p className="page-subtitle">Retrieving semester details and calculations...</p>
          </div>
        </div>

        <div className="grid grid-2" style={{ marginBottom: 20 }}>
          <div className="card" style={{ textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
            <div className="label">CGPA</div>
            <div className="skeleton-pulse skeleton-stat" style={{ width: 80, height: 48, borderRadius: 8, margin: "12px auto" }} />
            <div className="skeleton-pulse skeleton-text" style={{ width: "60%", height: 14, borderRadius: 4, margin: "0 auto" }} />
          </div>

          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="skeleton-pulse skeleton-text" style={{ width: "30%", height: 14, borderRadius: 4 }} />
            <div className="skeleton-pulse skeleton-text" style={{ width: "100%", height: 38, borderRadius: 999 }} />
            <div className="skeleton-pulse skeleton-text" style={{ width: "50%", height: 14, borderRadius: 4 }} />
            <div className="skeleton-pulse skeleton-text" style={{ width: "100%", height: 78, borderRadius: 16 }} />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[1, 2].map((n) => (
            <div key={n} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ width: "40%" }}>
                  <div className="skeleton-pulse skeleton-text" style={{ width: "70%", height: 16, borderRadius: 4, marginBottom: 8 }} />
                  <div className="skeleton-pulse skeleton-text" style={{ width: "50%", height: 12, borderRadius: 4 }} />
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[1, 2, 3].map((c) => (
                  <div key={c} className="skeleton-pulse skeleton-text" style={{ height: 32, borderRadius: 6, margin: 0 }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Grades</h1>
          <p className="page-subtitle">Upload a semester grade card — SGPA and CGPA are calculated automatically.</p>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="label">CGPA</div>
          <div className="stat-num" style={{ fontSize: 40 }}>{data.cgpa || "—"}</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{data.totalCredits} total credits across {data.semesters.length} semester(s)</div>
        </div>

        <form onSubmit={handleUpload} className="card">
          <label className="label" htmlFor="semester">Semester label</label>
          <input
            id="semester"
            className="input"
            placeholder="e.g. Semester 3"
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            style={{ marginBottom: 12 }}
          />
          <label className="label" htmlFor="gradefile">Grade card image or PDF</label>
          <FileUpload
            id="gradefile"
            accept="image/*,application/pdf"
            file={file}
            onChange={setFile}
            placeholder="Drag & drop your grade card here, or click to browse"
            helpText="Supports photo or PDF of your grade card"
          />
          <div style={{ height: 12 }} />
          {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}
          <button className="btn" type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Reading grade card…" : "Upload & calculate"}
          </button>
        </form>
      </div>

      {data.semesters.length === 0 && <div className="empty-state">No grade cards uploaded yet.</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {data.semesters.map((s) => (
          <div key={s.semester} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{s.semester}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.totalCredits} credits · SGPA {s.sgpa}</div>
              </div>
              <button onClick={() => removeSemester(s.semester)} className="btn-ghost btn" style={{ fontSize: 12, padding: "6px 10px", flexShrink: 0 }}>Remove</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {s.courses.map((c) => (
                <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 8px", borderRadius: 6, background: "var(--bg-elevated)", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ wordBreak: "break-word" }}>{c.course}</span>
                  <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{c.credits} cr · {c.grade} ({c.grade_points})</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
