import React, { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { fileToBase64 } from "../utils/fileToBase64.js";
import FileUpload from "../components/FileUpload.jsx";

// ── Grade colour map ─────────────────────────────────────────────────────────
const GRADE_COLORS = {
  O:   { bg: "rgba(255, 193, 7, 0.18)",  text: "#d4a017", label: "Outstanding" },
  "A+":{ bg: "rgba(79, 168, 138, 0.18)", text: "#4fa88a", label: "Excellent" },
  A:   { bg: "rgba(56, 189, 148, 0.16)", text: "#38bd94", label: "Very Good" },
  "B+":{ bg: "rgba(76, 126, 255, 0.18)", text: "#4c7eff", label: "Good" },
  B:   { bg: "rgba(139, 92, 246, 0.18)", text: "#8b5cf6", label: "Above Avg" },
  C:   { bg: "rgba(140, 148, 179, 0.16)","text": "#8c94b3", label: "Average" },
  P:   { bg: "rgba(140, 148, 179, 0.12)","text": "#8c94b3", label: "Pass" },
  F:   { bg: "rgba(193, 85, 74, 0.16)",  text: "#c1554a", label: "Fail" },
};

function gradeStyle(grade) {
  return GRADE_COLORS[grade] || { bg: "rgba(140,148,179,0.12)", text: "var(--text-muted)", label: grade };
}

// ── CGPA donut ring ──────────────────────────────────────────────────────────
function CGPARing({ cgpa }) {
  const max = 10;
  const r = 54;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(cgpa / max, 1);
  const dash = circ * pct;
  const gap  = circ - dash;

  const color =
    cgpa >= 8.5 ? "#4fa88a" :
    cgpa >= 7   ? "#4c7eff" :
    cgpa >= 5.5 ? "#f59e0b" : "#c1554a";

  return (
    <svg width="140" height="140" viewBox="0 0 140 140" style={{ overflow: "visible" }}>
      {/* Track */}
      <circle cx="70" cy="70" r={r} fill="none" stroke="var(--border)" strokeWidth="10" />
      {/* Progress */}
      <circle
        cx="70" cy="70" r={r}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${gap}`}
        strokeDashoffset={circ / 4}
        style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)" }}
      />
      {/* Label */}
      <text x="70" y="65" textAnchor="middle" fill="var(--text)"
        style={{ fontSize: 26, fontWeight: 700, fontFamily: "var(--font-mono)" }}>
        {cgpa > 0 ? cgpa.toFixed(2) : "—"}
      </text>
      <text x="70" y="83" textAnchor="middle" fill="var(--text-muted)"
        style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        CGPA
      </text>
    </svg>
  );
}

// ── Semester SGPA bar ────────────────────────────────────────────────────────
function SGPABar({ semester, sgpa, maxSgpa }) {
  const pct = maxSgpa > 0 ? (sgpa / maxSgpa) * 100 : 0;
  const color =
    sgpa >= 8.5 ? "#4fa88a" :
    sgpa >= 7   ? "#4c7eff" :
    sgpa >= 5.5 ? "#f59e0b" : "#c1554a";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
      <span style={{ width: 88, color: "var(--text-muted)", flexShrink: 0, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {semester}
      </span>
      <div style={{ flex: 1, height: 8, background: "var(--border)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`, background: color,
          borderRadius: 999,
          transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
        }} />
      </div>
      <span style={{ width: 36, textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 600, color, flexShrink: 0 }}>
        {sgpa}
      </span>
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
function GradesSkeleton() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Grades</h1>
          <p className="page-subtitle">Retrieving semester details…</p>
        </div>
      </div>
      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div className="skeleton-pulse" style={{ width: 140, height: 140, borderRadius: "50%" }} />
          <div className="skeleton-pulse skeleton-text" style={{ width: "60%" }} />
        </div>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="skeleton-pulse skeleton-text" style={{ width: "40%" }} />
          {[1, 2, 3].map(n => (
            <div key={n} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div className="skeleton-pulse" style={{ width: 80, height: 10, borderRadius: 999 }} />
              <div className="skeleton-pulse" style={{ flex: 1, height: 8, borderRadius: 999 }} />
              <div className="skeleton-pulse" style={{ width: 32, height: 10, borderRadius: 999 }} />
            </div>
          ))}
        </div>
      </div>
      {[1, 2].map(n => (
        <div key={n} className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <div className="skeleton-pulse skeleton-text" style={{ width: "30%" }} />
            <div className="skeleton-pulse" style={{ width: 60, height: 24, borderRadius: 999 }} />
          </div>
          {[1, 2, 3].map(c => (
            <div key={c} className="skeleton-pulse skeleton-text" style={{ height: 36, borderRadius: 12, marginBottom: 6 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Grades() {
  const [semester, setSemester]   = useState("");
  const [file, setFile]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError]         = useState("");
  const [data, setData]           = useState({ semesters: [], cgpa: 0, totalCredits: 0 });
  const [showUpload, setShowUpload] = useState(false);

  async function refresh() {
    try {
      const d = await api.get("/ai/grades");
      setData(d);
    } finally {
      setPageLoading(false);
    }
  }

  useEffect(() => { refresh().catch(() => {}); }, []);

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
        fileBase64, mimeType: file.type, semester: semester.trim(),
      });
      setData(result);
      setFile(null);
      setSemester("");
      setShowUpload(false);
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

  if (pageLoading) return <GradesSkeleton />;

  const maxSgpa = data.semesters.reduce((m, s) => Math.max(m, s.sgpa), 0) || 10;
  const cgpaColor =
    data.cgpa >= 8.5 ? "#4fa88a" :
    data.cgpa >= 7   ? "#4c7eff" :
    data.cgpa >= 5.5 ? "#f59e0b" : "var(--text-muted)";

  return (
    <div>
      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Grades</h1>
          <p className="page-subtitle">AI‑powered grade card reader — upload once, track forever.</p>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => setShowUpload(v => !v)}
          style={{ flexShrink: 0 }}
        >
          {showUpload ? "✕ Close" : "+ Upload grade card"}
        </button>
      </div>

      {/* ── Upload panel (collapsible) ── */}
      <div style={{
        overflow: "hidden",
        maxHeight: showUpload ? 600 : 0,
        transition: "max-height 0.4s cubic-bezier(0.4,0,0.2,1)",
        marginBottom: showUpload ? 20 : 0,
      }}>
        <form onSubmit={handleUpload} className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="label" style={{ margin: 0 }}>Upload grade card</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 180px", minWidth: 0 }}>
              <label className="label" htmlFor="semester">Semester label</label>
              <input
                id="semester" className="input"
                placeholder="e.g. Semester 3"
                value={semester}
                onChange={e => setSemester(e.target.value)}
              />
            </div>
            <div style={{ flex: "2 1 260px", minWidth: 0 }}>
              <label className="label" htmlFor="gradefile">Grade card image or PDF</label>
              <FileUpload
                id="gradefile" accept="image/*,application/pdf"
                file={file} onChange={setFile}
                placeholder="Drag & drop or click to browse"
                helpText="Supports photo or PDF of your grade card"
              />
            </div>
          </div>
          {error && <div className="error-text">{error}</div>}
          <button className="btn" type="submit" disabled={loading} style={{ alignSelf: "flex-start", minWidth: 180 }}>
            {loading ? "Reading grade card…" : "Upload & calculate"}
          </button>
        </form>
      </div>

      {/* ── Top stats row ── */}
      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        {/* CGPA ring */}
        <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "28px 20px" }}>
          <CGPARing cgpa={data.cgpa} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {data.totalCredits} total credits
              {data.semesters.length > 0 && ` · ${data.semesters.length} semester${data.semesters.length > 1 ? "s" : ""}`}
            </div>
            {data.cgpa > 0 && (
              <div style={{
                marginTop: 6,
                display: "inline-block",
                padding: "3px 14px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                background: cgpaColor + "22",
                color: cgpaColor,
                letterSpacing: "0.04em",
              }}>
                {data.cgpa >= 9 ? "🏆 Outstanding" :
                 data.cgpa >= 8 ? "⭐ Excellent" :
                 data.cgpa >= 7 ? "👍 Good standing" :
                 data.cgpa >= 5 ? "📈 Keep pushing" : "⚠️ Needs improvement"}
              </div>
            )}
          </div>
        </div>

        {/* SGPA trend chart */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="label" style={{ marginBottom: 4 }}>SGPA by semester</div>
          {data.semesters.length === 0 ? (
            <div className="empty-state" style={{ padding: "30px 0" }}>No semesters yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data.semesters.map(s => (
                <SGPABar key={s.semester} semester={s.semester} sgpa={s.sgpa} maxSgpa={maxSgpa} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Empty state ── */}
      {data.semesters.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "40px 24px" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎓</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No grades uploaded yet</div>
          <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20 }}>
            Upload a photo or PDF of your semester grade card and the AI will extract your scores automatically.
          </div>
          <button className="btn" onClick={() => setShowUpload(true)}>Upload your first grade card</button>
        </div>
      )}

      {/* ── Semester cards ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {data.semesters.map((s, idx) => {
          const sgpaColor =
            s.sgpa >= 8.5 ? "#4fa88a" :
            s.sgpa >= 7   ? "#4c7eff" :
            s.sgpa >= 5.5 ? "#f59e0b" : "#c1554a";

          return (
            <div key={s.semester} className="card" style={{
              animation: `fadeSlideIn 0.35s ${idx * 0.06}s both`,
            }}>
              {/* Semester header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  {/* SGPA badge */}
                  <div style={{
                    width: 52, height: 52, borderRadius: "50%",
                    background: sgpaColor + "18",
                    border: `2px solid ${sgpaColor}44`,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: sgpaColor, fontFamily: "var(--font-mono)", lineHeight: 1 }}>{s.sgpa}</span>
                    <span style={{ fontSize: 9, color: sgpaColor, letterSpacing: "0.06em", opacity: 0.8 }}>SGPA</span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{s.semester}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.totalCredits} credits · {s.courses.length} courses</div>
                  </div>
                </div>
                <button
                  onClick={() => removeSemester(s.semester)}
                  className="btn-ghost btn"
                  style={{ fontSize: 12, padding: "5px 14px", color: "var(--absent)", borderColor: "var(--absent)22", flexShrink: 0 }}
                >
                  Remove
                </button>
              </div>

              {/* Course table */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {/* Header row */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 72px 72px 72px",
                  gap: 8,
                  padding: "4px 12px",
                  fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: "0.06em", color: "var(--text-muted)",
                }}>
                  <span>Course</span>
                  <span style={{ textAlign: "center" }}>Credits</span>
                  <span style={{ textAlign: "center" }}>Grade</span>
                  <span style={{ textAlign: "center" }}>Points</span>
                </div>

                {s.courses.map(c => {
                  const gs = gradeStyle(c.grade);
                  return (
                    <div key={c.id} style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 72px 72px 72px",
                      gap: 8,
                      padding: "9px 12px",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--bg-elevated)",
                      fontSize: 13,
                      alignItems: "center",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--panel-hover)"}
                    onMouseLeave={e => e.currentTarget.style.background = "var(--bg-elevated)"}
                    >
                      <span style={{ wordBreak: "break-word", fontWeight: 500 }}>{c.course}</span>
                      <span style={{ textAlign: "center", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{c.credits}</span>
                      <span style={{ textAlign: "center" }}>
                        <span style={{
                          display: "inline-block", padding: "2px 10px",
                          borderRadius: 999, fontSize: 12, fontWeight: 700,
                          background: gs.bg, color: gs.text,
                        }}>{c.grade}</span>
                      </span>
                      <span style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontWeight: 600, color: gs.text }}>{c.grade_points}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
