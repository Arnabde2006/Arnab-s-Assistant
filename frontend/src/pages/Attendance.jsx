import React, { useEffect, useState } from "react";
import { api } from "../api/client.js";
import AttendanceRing from "../components/AttendanceRing.jsx";
import BunkSimulator from "../components/BunkSimulator.jsx";
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
  const [pageLoading, setPageLoading] = useState(true);
  const [uploadError, setUploadError] = useState("");
  const [uploadResult, setUploadResult] = useState(null);
  const today = toISO(new Date());
  const yesterday = toISO(new Date(Date.now() - 86400000));
  const [selectedDate, setSelectedDate] = useState(today);

  async function refresh() {
    try {
      const [sum, recs, hols] = await Promise.all([
        api.get("/attendance/summary"),
        api.get("/attendance"),
        api.get("/holidays"),
      ]);
      setSummary(sum);
      setRecords(recs.records);
      setHolidays(hols.holidays);
    } finally {
      setPageLoading(false);
    }
  }

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  if (pageLoading) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Attendance</h1>
            <p className="page-subtitle">Retrieving attendance logs...</p>
          </div>
        </div>

        <div className="grid grid-2" style={{ marginBottom: 20 }}>
          <div className="card" style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <div className="skeleton-pulse" style={{ width: 100, height: 100, borderRadius: "50%", flexShrink: 0 }} />
            <div style={{ flexGrow: 1 }}>
              <div className="skeleton-pulse skeleton-text" style={{ width: "40%", height: 14, borderRadius: 4 }} />
              <div className="skeleton-pulse skeleton-text" style={{ width: "70%", height: 14, borderRadius: 4 }} />
              <div className="skeleton-pulse skeleton-text" style={{ width: "50%", height: 14, borderRadius: 4 }} />
            </div>
          </div>
          <div className="card" style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <div className="skeleton-pulse" style={{ width: 100, height: 100, borderRadius: "50%", flexShrink: 0 }} />
            <div style={{ flexGrow: 1 }}>
              <div className="skeleton-pulse skeleton-text" style={{ width: "50%", height: 14, borderRadius: 4 }} />
              <div className="skeleton-pulse skeleton-text" style={{ width: "60%", height: 14, borderRadius: 4 }} />
              <div className="skeleton-pulse skeleton-text" style={{ width: "40%", height: 14, borderRadius: 4 }} />
            </div>
          </div>
        </div>

        <div className="grid grid-2" style={{ marginBottom: 20 }}>
          <div className="card">
            <div className="skeleton-pulse skeleton-text" style={{ width: "40%", height: 14, borderRadius: 4, marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 8 }}>
              {[1, 2, 3, 4].map(n => (
                <div key={n} className="skeleton-pulse" style={{ width: 75, height: 38, borderRadius: 8 }} />
              ))}
            </div>
          </div>
          <div className="card">
            <div className="skeleton-pulse skeleton-text" style={{ width: "30%", height: 14, borderRadius: 4, marginBottom: 12 }} />
            <div className="skeleton-pulse" style={{ width: "100%", height: 78, borderRadius: 16 }} />
          </div>
        </div>

        <div className="card">
          <div className="skeleton-pulse skeleton-text" style={{ width: "20%", height: 14, borderRadius: 4, marginBottom: 16 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <div key={n} className="skeleton-pulse" style={{ width: "100%", height: 36, borderRadius: 8 }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  async function mark(date, key) {
    if (key === "no_college") {
      await api.post("/holidays", { date });
    } else {
      await api.post("/attendance", { date, status: key });
    }
    refresh();
  }

  async function clearMark(entry) {
    if (!entry || !entry.type || !entry.rawId) return;
    if (entry.type === "att") {
      await api.delete(`/attendance/${entry.rawId}`);
    } else if (entry.type === "hol") {
      await api.delete(`/holidays/${entry.rawId}`);
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

  // Build lookup map for attendance and holidays by date string
  const mergedMap = new Map();
  records.forEach((r) => mergedMap.set(r.date, { key: r.status, id: r.id, type: "att" }));
  holidays.forEach((h) => mergedMap.set(h.date, { key: "no_college", id: h.id, type: "hol", reason: h.reason }));

  // Generate the last 14 consecutive calendar days, highlighting unmarked days
  const past14Days = [];
  const curr = new Date();
  for (let i = 0; i < 14; i++) {
    const dStr = toISO(curr);
    const entry = mergedMap.get(dStr);
    past14Days.push({
      date: dStr,
      isToday: dStr === today,
      key: entry ? entry.key : null,
      id: entry ? `${entry.type}-${entry.id}` : `unmarked-${dStr}`,
      rawId: entry?.id,
      type: entry?.type,
      reason: entry?.reason,
    });
    curr.setDate(curr.getDate() - 1);
  }

  const selectedEntry = mergedMap.get(selectedDate);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance</h1>
          <p className="page-subtitle">Mark your whole day — present, absent, half day, or no college.</p>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <div className="card" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <AttendanceRing
            percentage={summary?.percentage || 0}
            color={summary && summary.percentage >= summary.goal ? "var(--present)" : "var(--absent)"}
            size={100}
          />
          <div style={{ flex: "1 1 180px" }}>
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

        <div className="card" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <AttendanceRing
            percentage={summary?.college?.percentage || 0}
            color={summary && summary.college.percentage >= summary.goal ? "var(--present)" : "var(--absent)"}
            size={100}
          />
          <div style={{ flex: "1 1 180px" }}>
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

      {summary && <BunkSimulator summary={summary} />}

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
            <div className="label">
              Log day — {formatNice(selectedDate)}
              {selectedDate === today && <span style={{ color: "var(--accent)", marginLeft: 6 }}>(Today)</span>}
              {selectedDate === yesterday && <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>(Yesterday)</span>}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                type="button"
                className="btn"
                style={{ fontSize: 12, padding: "4px 10px", background: selectedDate === today ? "var(--accent-soft)" : "transparent", borderColor: selectedDate === today ? "var(--accent)" : "var(--border)" }}
                onClick={() => setSelectedDate(today)}
              >
                Today
              </button>
              <button
                type="button"
                className="btn"
                style={{ fontSize: 12, padding: "4px 10px", background: selectedDate === yesterday ? "var(--accent-soft)" : "transparent", borderColor: selectedDate === yesterday ? "var(--accent)" : "var(--border)" }}
                onClick={() => setSelectedDate(yesterday)}
              >
                Yesterday
              </button>
              <input
                type="date"
                value={selectedDate}
                max={today}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                style={{
                  fontSize: 12,
                  padding: "3px 8px",
                  borderRadius: 8,
                  border: "1px solid var(--border-strong)",
                  background: "var(--bg-elevated)",
                  color: "var(--text)",
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Object.entries(STATUS_META).map(([key, meta]) => (
              <button
                key={key}
                className="btn"
                style={{
                  background: selectedEntry?.key === key ? meta.color : "var(--bg-elevated)",
                  color: selectedEntry?.key === key ? "var(--accent-text)" : "var(--text)",
                  border: `1px solid ${selectedEntry?.key === key ? meta.color : "var(--border-strong)"}`,
                }}
                onClick={() => mark(selectedDate, key)}
              >
                {meta.label}
              </button>
            ))}
          </div>

          {selectedEntry ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, fontSize: 12, color: "var(--text-muted)" }}>
              <span>Marked as: <strong>{STATUS_META[selectedEntry.key]?.label || selectedEntry.key}</strong></span>
              <button
                type="button"
                style={{ border: "none", background: "none", color: "var(--absent)", cursor: "pointer", fontSize: 12, textDecoration: "underline" }}
                onClick={() => clearMark(selectedEntry)}
              >
                Clear mark
              </button>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 12 }}>Not marked yet.</p>
          )}
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div className="label">Recent 14 days</div>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Click any status to set or change past attendance</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {past14Days.map((r) => (
            <div key={r.id} className="day-status-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 8, background: "var(--bg-elevated)", opacity: r.key ? 1 : 0.85 }}>
              <span style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                <strong>{formatNice(r.date)}</strong>
                {r.isToday && <span style={{ fontSize: 11, color: "var(--accent)" }}>(Today)</span>}
                {!r.key && (
                  <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(193,85,74,0.12)", color: "var(--absent)", border: "1px dashed var(--absent)" }}>
                    Unmarked
                  </span>
                )}
                {r.key === "no_college" && r.reason && <span style={{ color: "var(--text-muted)" }}> · {r.reason}</span>}
              </span>
              <span className="status-buttons" style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
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
                      cursor: "pointer",
                    }}
                  >
                    {meta.label}
                  </button>
                ))}
                {r.key && (
                  <button
                    type="button"
                    title="Clear attendance mark for this day"
                    onClick={() => clearMark(r)}
                    style={{
                      fontSize: 12,
                      padding: "4px 6px",
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      background: "transparent",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      marginLeft: 4,
                    }}
                  >
                    ✕
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
