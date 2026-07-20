import React, { useEffect, useState } from "react";
import { api } from "../api/client.js";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Timetable() {
  const [subjects, setSubjects] = useState([]);
  const [slots, setSlots] = useState([]);
  const [form, setForm] = useState({ subjectId: "", dayOfWeek: 1, startTime: "09:00", endTime: "10:00", room: "" });
  const [pageLoading, setPageLoading] = useState(true);

  async function refresh() {
    try {
      const [s, t] = await Promise.all([api.get("/subjects"), api.get("/timetable")]);
      setSubjects(s.subjects);
      setSlots(t.slots);
      if (s.subjects.length && !form.subjectId) {
        setForm((f) => ({ ...f, subjectId: s.subjects[0].id }));
      }
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
            <h1 className="page-title">Timetable</h1>
            <p className="page-subtitle">Retrieving weekly class schedule...</p>
          </div>
        </div>

        <div className="card" style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} style={{ flex: 1, minWidth: 100 }}>
              <div className="skeleton-pulse skeleton-text" style={{ width: "50%", height: 12, borderRadius: 4 }} />
              <div className="skeleton-pulse skeleton-text" style={{ width: "100%", height: 38, borderRadius: 8, margin: 0 }} />
            </div>
          ))}
        </div>

        <div className="grid timetable-grid" style={{ gridTemplateColumns: "repeat(7, 1fr)", gap: 10 }}>
          {DAYS.map((d) => (
            <div key={d} className="card" style={{ minHeight: 140 }}>
              <div className="label" style={{ marginBottom: 10 }}>{d}</div>
              <div className="skeleton-pulse skeleton-text" style={{ width: "80%", height: 14, borderRadius: 4, marginBottom: 6 }} />
              <div className="skeleton-pulse skeleton-text" style={{ width: "60%", height: 10, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  async function addSlot(e) {
    e.preventDefault();
    if (!form.subjectId) return;
    await api.post("/timetable", form);
    refresh();
  }

  async function removeSlot(id) {
    await api.del(`/timetable/${id}`);
    refresh();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Timetable</h1>
          <p className="page-subtitle">Your weekly class schedule.</p>
        </div>
      </div>

      {subjects.length === 0 ? (
        <div className="empty-state">Add subjects on the Attendance page first.</div>
      ) : (
        <form onSubmit={addSlot} className="card" style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label className="label">Subject</label>
            <select className="input" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
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
          <button className="btn" type="submit">Add class</button>
        </form>
      )}

      <div className="grid timetable-grid" style={{ gridTemplateColumns: "repeat(7, 1fr)", gap: 10 }}>
        {DAYS.map((d, i) => (
          <div key={d} className="card" style={{ minHeight: 140 }}>
            <div className="label" style={{ marginBottom: 10 }}>{d}</div>
            {slots.filter((s) => s.dayOfWeek === i).length === 0 && (
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>—</div>
            )}
            {slots.filter((s) => s.dayOfWeek === i).map((s) => (
              <div key={s._id} style={{ marginBottom: 10, paddingLeft: 8, borderLeft: `3px solid ${s.subject?.color || "var(--accent)"}` }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{s.subject?.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.startTime}–{s.endTime} {s.room && `· ${s.room}`}</div>
                <button onClick={() => removeSlot(s._id)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 11, padding: 0, marginTop: 2 }}>Remove</button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
