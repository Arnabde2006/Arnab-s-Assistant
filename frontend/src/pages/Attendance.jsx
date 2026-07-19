import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import AttendanceRing from "../components/AttendanceRing.jsx";
import FileUpload from "../components/FileUpload.jsx";
import { fileToBase64 } from "../utils/fileToBase64.js";

function pad(n) {
  return String(n).padStart(2, "0");
}
function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function formatNice(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

const STATUS_META = {
  present: { label: "Present", color: "var(--present)" },
  absent: { label: "Absent", color: "var(--absent)" },
  half_day: { label: "Half day", color: "#C9A227" },
  no_college: { label: "No college", color: "var(--text-muted)" },
};

export default function Attendance() {
  const [summary, setSummary] = useState(null);
  const [records, setRecords] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [holidayFile, setHolidayFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadResult, setUploadResult] = useState(null);
  const today = toISO(new Date());

  async function refresh() {
    const [sum, recs, hols] = await Promise.all([
      api.get("/attendance/summary"),
      api.get("/attendance"),
      api.get("/holidays"),
    ]);
    setSummary(sum);
    setRecords(recs.records);
    setHolidays(hols.holidays);
  }

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  async function mark(date, key) {
    if (key === "no_college") {
      await api.post("/holidays", { date });
    } else {
      await api.post("/attendance", { date, status: key });
    }
    refresh();
  }

  async function uploadHolidayList(e) {
    e.preventDefault();
    if (!holidayFile) {
      setUploadError("Choose an image or PDF of your holiday list first.");
      return;
    }
    setUploadError("");
    setUploadResult(null);
    setUploadLoading(true);
    try {
      const fileBase64 = await fileToBase64(holidayFile);
      const result = await api.post("/holidays/upload", { fileBase64, mimeType: holidayFile.type });
      setUploadResult(result);
      setHolidayFile(null);
      refresh();
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploadLoading(false);
    }
  }

  // Merge attendance records + holidays into one list of "days with a status", newest first.
  const holidaySet = new Map(holidays.map((h) => [h.date, h]));
  const merged = [
    ...records.map((r) => ({ date: r.date, key: r.status, id: `att-${r.id}` })),
    ...holidays.map((h) => ({ date: h.date, key: "no_college", id: `hol-${h.id}`, reason: h.reason })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  const todayEntry = merged.find((r) => r.date === today);
  const recent = merged.slice(0, 14);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance</h1>
          <p className="page-subtitle">Mark your whole day — present, absent, half day, or no college.</p>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <div className="card" style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <AttendanceRing
            percentage={summary?.percentage || 0}
            color={summary && summary.percentage >= summary.goal ? "var(--present)" : "var(--absent)"}
            size={100}
          />
          <div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Overall attendance</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>
              {summary ? `${summary.present} present · ${summary.halfDay} half days · ${summary.absent} absent` : "—"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              {summary ? `Based on ${summary.total} college day(s) — ${summary.holidaysCount} day(s) excluded as no-college` : ""}
            </div>
            {summary && summary.percentage < summary.goal && summary.daysNeeded > 0 && (
              <div style={{ fontSize: 13, marginTop: 8 }}>
                Attend the next <strong>{summary.daysNeeded}</strong> day(s) in a row to reach {summary.goal}%.
              </div>
            )}
            {summary && summary.percentage >= summary.goal && summary.safeToMiss > 0 && (
              <div style={{ fontSize: 13, marginTop: 8 }}>
                You can safely miss <strong>{summary.safeToMiss}</strong> more day(s) and stay above {summary.goal}%.
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <AttendanceRing
            percentage={summary?.college?.percentage || 0}
            color={summary && summary.college.percentage >= summary.goal ? "var(--present)" : "var(--absent)"}
            size={100}
          />
          <div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Attendance according to college</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              Each full day = 2 points, half day = 1 point
            </div>
            <div style={{ fontSize: 13, marginTop: 6 }}>
              {summary ? `${summary.college.earnedPoints} / ${summary.college.maxPoints} points` : "—"}
            </div>
            {summary && summary.college.percentage < summary.goal && summary.college.daysNeeded > 0 && (
              <div style={{ fontSize: 13, marginTop: 8 }}>
                Attend the next <strong>{summary.college.daysNeeded}</strong> full day(s) in a row to reach {summary.goal}%.
              </div>
            )}
            {summary && summary.college.percentage >= summary.goal && summary.college.safeToMiss > 0 && (
              <div style={{ fontSize: 13, marginTop: 8 }}>
                You can safely miss <strong>{summary.college.safeToMiss}</strong> more full day(s) and stay above {summary.goal}%.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="label" style={{ marginBottom: 12 }}>Today — {formatNice(today)}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Object.entries(STATUS_META).map(([key, meta]) => (
              <button
                key={key}
                className="btn"
                style={{
                  background: todayEntry?.key === key ? meta.color : "var(--bg-elevated)",
                  color: todayEntry?.key === key ? "var(--accent-text)" : "var(--text)",
                  border: `1px solid ${todayEntry?.key === key ? meta.color : "var(--border-strong)"}`,
                }}
                onClick={() => mark(today, key)}
              >
                {meta.label}
              </button>
            ))}
          </div>
          {!todayEntry && <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 12 }}>Not marked yet.</p>}
        </div>

        <form onSubmit={uploadHolidayList} className="card">
          <div className="label" style={{ marginBottom: 8 }}>Upload holiday list</div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
            Photo or PDF of your college's holiday calendar — every date found gets marked "No college" automatically.
          </p>
          <FileUpload
            id="holiday-file-upload"
            accept="image/*,application/pdf"
            file={holidayFile}
            onChange={setHolidayFile}
            placeholder="Drag & drop your holiday calendar here, or click to browse"
            helpText="Supports photo or PDF of your college calendar"
          />
          <div style={{ height: 12 }} />
          {uploadError && <div className="error-text" style={{ marginBottom: 10 }}>{uploadError}</div>}
          {uploadResult && (
            <div style={{ fontSize: 12, color: "var(--present)", marginBottom: 10 }}>
              {uploadResult.count > 0 ? `Marked ${uploadResult.count} day(s) as no-college.` : "No holidays found in that file."}
            </div>
          )}
          <button className="btn" type="submit" disabled={uploadLoading}>
            {uploadLoading ? "Reading list…" : "Upload"}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="label" style={{ marginBottom: 12 }}>Recent days</div>
        {recent.length === 0 && <div className="empty-state">No attendance marked yet.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {recent.map((r) => (
            <div key={r.id} className="day-status-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 8, background: "var(--bg-elevated)" }}>
              <span style={{ fontSize: 13 }}>
                {formatNice(r.date)}
                {r.key === "no_college" && r.reason && <span style={{ color: "var(--text-muted)" }}> · {r.reason}</span>}
              </span>
              <span className="status-buttons" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {Object.entries(STATUS_META).map(([key, meta]) => (
                  <button
                    key={key}
                    onClick={() => mark(r.date, key)}
                    style={{
                      fontSize: 11,
                      padding: "4px 8px",
                      borderRadius: 6,
                      border: `1px solid ${r.key === key ? meta.color : "var(--border)"}`,
                      background: r.key === key ? meta.color : "transparent",
                      color: r.key === key ? "var(--accent-text)" : "var(--text-muted)",
                    }}
                  >
                    {meta.label}
                  </button>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
