import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle.jsx";
import AttendanceRing from "../components/AttendanceRing.jsx";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function formatNice(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

const STATUS_LABEL = { present: "Present", absent: "Absent", half_day: "Half day" };

export default function ViewOnly() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/view/${token}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Couldn't load this link");
        setData(body);
      })
      .catch((err) => setError(err.message));
  }, [token]);

  if (error) {
    return (
      <div className="auth-wrap">
        <div className="auth-card" style={{ textAlign: "center" }}>
          <h1 className="auth-title">Link not found</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 8 }}>{error}</p>
          <Link to="/login" style={{ color: "var(--accent)", fontSize: 14, display: "inline-block", marginTop: 16 }}>
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title" style={{ wordBreak: "break-word" }}>{data.name}'s overview</h1>
          <p className="page-subtitle">View-only — attendance and calendar, nothing here can be edited.</p>
        </div>
        <ThemeToggle />
      </div>

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <div className="card" style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <AttendanceRing
            percentage={data.attendance.percentage}
            color={data.attendance.percentage >= data.attendance.goal ? "var(--present)" : "var(--absent)"}
          />
          <div>
            <div className="label" style={{ marginBottom: 4 }}>Overall attendance</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {data.attendance.present} present · {data.attendance.halfDay} half days · {data.attendance.absent} absent
            </div>
          </div>
        </div>
        <div className="card" style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <AttendanceRing
            percentage={data.attendance.college.percentage}
            color={data.attendance.college.percentage >= data.attendance.goal ? "var(--present)" : "var(--absent)"}
          />
          <div>
            <div className="label" style={{ marginBottom: 4 }}>According to college</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {data.attendance.college.earnedPoints} / {data.attendance.college.maxPoints} points
            </div>
          </div>
        </div>
      </div>

      {data.exams.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="label" style={{ marginBottom: 10 }}>Upcoming exams</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {data.exams.map((e) => (
              <div key={e.id} style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-elevated)", fontSize: 13 }}>
                <strong>{e.course}</strong> · {e.exam_date}{e.exam_time ? ` · ${e.exam_time}` : ""}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="label" style={{ marginBottom: 12 }}>Calendar (next 60 days)</div>
        {data.todos.length === 0 && <div className="empty-state">Nothing scheduled.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {data.todos.map((t) => (
            <div key={t.id} className={"todo-item" + (t.done ? " done" : "")} style={{ cursor: "default" }}>
              <span className={`priority-dot priority-${t.priority}`} />
              <span style={{ flex: 1 }}>{t.text}</span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{formatNice(t.date)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="label" style={{ marginBottom: 12 }}>Recent days</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {data.recentAttendance.map((r) => (
            <div key={r.date} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 10px", borderRadius: 6, background: "var(--bg-elevated)" }}>
              <span>{formatNice(r.date)}</span>
              <span style={{ color: "var(--text-muted)" }}>{STATUS_LABEL[r.status]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
