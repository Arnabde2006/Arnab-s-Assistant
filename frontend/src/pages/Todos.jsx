import React, { useEffect, useState, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useAsyncAction } from "../hooks/useAsyncAction.js";
import Switch from "../components/Switch.jsx";
import { CreditCard, Pencil, Check, X } from "lucide-react";

function pad(n) {
  return String(n).padStart(2, "0");
}
function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function formatDay(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return { weekday: d.toLocaleDateString(undefined, { weekday: "short" }), num: d.getDate(), month: d.toLocaleDateString(undefined, { month: "short" }) };
}

// ── Inline Edit Modal ─────────────────────────────────────────────────────────
function EditTodoModal({ todo, onSave, onClose }) {
  const [text, setText] = useState(todo.text);
  const [date, setDate] = useState(todo.date);
  const [priority, setPriority] = useState(todo.priority);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    if (!text.trim()) return;
    await onSave(todo.id, { text: text.trim(), date, priority });
  }

  return (
    <div className="edit-todo-overlay" onClick={onClose}>
      <div className="edit-todo-modal" onClick={(e) => e.stopPropagation()}>
        <div className="edit-todo-header">
          <span className="edit-todo-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Pencil size={16} style={{ color: "var(--primary-color)" }} /> Edit Event
          </span>
          <button className="edit-todo-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSave} className="edit-todo-form">
          <label className="edit-todo-label">Title</label>
          <input
            ref={inputRef}
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Event title..."
          />

          <label className="edit-todo-label">Date</label>
          <input
            className="input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          <label className="edit-todo-label">Priority</label>
          <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="low">🟢 Low</option>
            <option value="normal">🔵 Normal</option>
            <option value="urgent">🔴 Urgent</option>
          </select>

          <div className="edit-todo-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn">
              <Check size={14} /> Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Todos() {
  const [note, setNote] = useState("");
  const [priority, setPriority] = useState("normal");
  const [todos, setTodos] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [nptelAssignments, setNptelAssignments] = useState([]);
  const [showHolidays, setShowHolidays] = useState(() => localStorage.getItem("showHolidays") !== "false");
  const [pageLoading, setPageLoading] = useState(true);
  const [editingTodo, setEditingTodo] = useState(null); // todo object being edited
  const [loadError, setLoadError] = useState("");
  const { run, pending } = useAsyncAction();

  useEffect(() => {
    localStorage.setItem("showHolidays", String(showHolidays));
  }, [showHolidays]);

  const rangeStart = toISO(new Date());
  const rangeEndDate = new Date();
  rangeEndDate.setDate(rangeEndDate.getDate() + 60);
  const rangeEnd = toISO(rangeEndDate);

  async function refresh() {
    try {
      const [todosData, holidaysData, subsData, nptelData] = await Promise.all([
        api.get(`/todos?from=${rangeStart}&to=${rangeEnd}`),
        api.get(`/holidays?from=${rangeStart}&to=${rangeEnd}`),
        api.get("/subscriptions").catch(() => ({ subscriptions: [] })),
        api.get("/nptel").catch(() => ({ allAssignments: [] })),
      ]);
      setTodos(todosData.todos);
      setHolidays(holidaysData.holidays);
      setSubscriptions(subsData.subscriptions || []);
      setNptelAssignments(nptelData.allAssignments || []);
    } finally {
      setPageLoading(false);
    }
  }

  useEffect(() => {
    // Surface a failed load instead of silently rendering an empty planner.
    refresh().catch((err) => setLoadError(err.message || "Couldn't load your planner."));
  }, []);

  // Active subscriptions mapping by date
  const activeSubs = useMemo(
    () => subscriptions.filter((s) => s.status === "active"),
    [subscriptions]
  );

  // Build the day range and precompute date→events lookups ONCE per data change,
  // instead of scanning every todo / subscription / assignment inside the render
  // loop for each of the ~60 days (previously O(days × items) every render).
  // These hooks must run on every render (before any early return) to satisfy
  // the Rules of Hooks; during loading the source arrays are empty so they're cheap.
  const { days, todosByDate, subEventsByDate, nptelByDate } = useMemo(() => {
    const furthestTodoDate = todos.reduce((max, t) => (t.date > max ? t.date : max), rangeStart);
    const furthestSubDate = activeSubs.reduce((max, s) => {
      const renewal = s.renewal_date ? s.renewal_date.split("T")[0] : "";
      return renewal > max ? renewal : max;
    }, rangeStart);
    const maxDateStr = furthestTodoDate > furthestSubDate ? furthestTodoDate : furthestSubDate;
    const daysCount = Math.max(
      14,
      Math.round((new Date(maxDateStr) - new Date(rangeStart)) / 86400000) + 1
    );

    const days = [];
    for (let i = 0; i < daysCount; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      days.push(toISO(d));
    }

    const todosByDate = new Map();
    for (const t of todos) {
      if (!todosByDate.has(t.date)) todosByDate.set(t.date, []);
      todosByDate.get(t.date).push(t);
    }

    const subEventsByDate = new Map();
    const pushSubEvent = (date, evt) => {
      if (!subEventsByDate.has(date)) subEventsByDate.set(date, []);
      subEventsByDate.get(date).push(evt);
    };
    for (const sub of activeSubs) {
      if (!sub.renewal_date) continue;
      const renDateStr = sub.renewal_date.split("T")[0];
      const isTrial = sub.plan_type === "free_trial";
      pushSubEvent(renDateStr, { sub, type: "renewal_day", isTrial });
      const renDateObj = new Date(renDateStr + "T00:00:00");
      const remindDateObj = new Date(renDateObj);
      remindDateObj.setDate(remindDateObj.getDate() - (sub.remind_days_before || 3));
      const remindDateStr = toISO(remindDateObj);
      // A 0-day reminder collapses onto the renewal day — original showed only
      // the renewal event in that case, so skip the duplicate reminder.
      if (remindDateStr !== renDateStr) {
        pushSubEvent(remindDateStr, { sub, type: "reminder_day", isTrial });
      }
    }

    const nptelByDate = new Map();
    for (const a of nptelAssignments) {
      if (!a.due_date) continue;
      const key = a.due_date.split("T")[0];
      if (!nptelByDate.has(key)) nptelByDate.set(key, []);
      nptelByDate.get(key).push(a);
    }

    return { days, todosByDate, subEventsByDate, nptelByDate };
  }, [todos, activeSubs, nptelAssignments, rangeStart]);

  const holidayMap = useMemo(() => new Map(holidays.map((h) => [h.date, h])), [holidays]);

  if (pageLoading) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">To‑do &amp; Calendar</h1>
            <p className="page-subtitle">Retrieving planner items...</p>
          </div>
        </div>

        <div className="card" style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <div className="skeleton-pulse" style={{ flex: 1, minWidth: 200, height: 38, borderRadius: 8 }} />
          <div className="skeleton-pulse" style={{ width: 120, height: 38, borderRadius: 8 }} />
          <div className="skeleton-pulse" style={{ width: 70, height: 38, borderRadius: 8 }} />
        </div>

        <div className="planner" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="planner-row" style={{ minHeight: 60, display: "flex", alignItems: "center" }}>
              <div className="planner-date" style={{ display: "flex", flexDirection: "column", gap: 4, width: 60 }}>
                <div className="skeleton-pulse skeleton-text" style={{ width: "80%", height: 10, borderRadius: 4 }} />
                <div className="skeleton-pulse skeleton-text" style={{ width: "50%", height: 16, borderRadius: 4 }} />
              </div>
              <div className="planner-items" style={{ flexGrow: 1, paddingLeft: 16 }}>
                <div className="skeleton-pulse skeleton-text" style={{ width: n % 2 === 0 ? "40%" : "20%", height: 14, borderRadius: 4, margin: 0 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  async function addNote(e) {
    e.preventDefault();
    if (!note.trim()) return;
    const { ok } = await run(() => api.post("/todos", { text: note.trim(), priority }), {
      errorMessage: "Couldn't add that task",
    });
    if (!ok) return;
    setNote("");
    setPriority("normal");
    await run(refresh, { errorMessage: "Saved, but the list may be out of date" });
  }

  async function toggleDone(todo) {
    const { ok } = await run(() => api.put(`/todos/${todo.id}`, { done: !todo.done }), {
      errorMessage: todo.done ? "Couldn't reopen that task" : "Couldn't complete that task",
    });
    if (ok) await run(refresh, { errorMessage: "Saved, but the list may be out of date" });
  }

  async function removeTodo(id) {
    const { ok } = await run(() => api.del(`/todos/${id}`), {
      errorMessage: "Couldn't delete that task",
    });
    if (ok) await run(refresh, { errorMessage: "Saved, but the list may be out of date" });
  }

  async function saveEdit(id, fields) {
    const { ok } = await run(() => api.put(`/todos/${id}`, fields), {
      errorMessage: "Couldn't save those changes",
    });
    // Keep the modal open on failure so the user's edits aren't thrown away.
    if (!ok) return;
    setEditingTodo(null);
    await run(refresh, { errorMessage: "Saved, but the list may be out of date" });
  }

  return (
    <div>
      {/* Edit Modal */}
      {editingTodo && (
        <EditTodoModal
          todo={editingTodo}
          onSave={saveEdit}
          onClose={() => setEditingTodo(null)}
        />
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">To‑do &amp; Calendar</h1>
          <p className="page-subtitle">Type a note — it lands on the right day automatically. Subscription &amp; trial reminders display automatically.</p>
        </div>
        <Switch checked={showHolidays} onChange={setShowHolidays} label="Show college‑off days" />
      </div>

      {loadError && (
        <div className="load-error" role="alert">
          <span>{loadError}</span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              setLoadError("");
              refresh().catch((err) => setLoadError(err.message || "Couldn't load your planner."));
            }}
          >
            Retry
          </button>
        </div>
      )}

      <form onSubmit={addNote} className="card" style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          className="input"
          placeholder="e.g. Assignment 2 due tomorrow"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ flex: "1 1 200px" }}
        />
        <select className="input" style={{ width: 120 }} value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="urgent">Urgent</option>
        </select>
        <button className="btn" type="submit" disabled={pending}>{pending ? "Adding…" : "Add"}</button>
      </form>

      <div className="planner">
        {days.map((date) => {
          const dayTodos = todosByDate.get(date) || [];
          const holiday = holidayMap.get(date);
          const isHoliday = showHolidays && !!holiday;
          const { weekday, num, month } = formatDay(date);

          // Subscription (renewal + reminder) events for this date, precomputed above.
          const subEvents = subEventsByDate.get(date) || [];

          // NPTEL assignment events for this date, precomputed above.
          const dayNptelAssignments = nptelByDate.get(date) || [];

          const hasItems = dayTodos.length > 0 || subEvents.length > 0 || dayNptelAssignments.length > 0;

          return (
            <div className={"planner-row" + (isHoliday ? " is-holiday" : "")} key={date}>
              <div className="planner-date">
                {weekday}
                <span className="day-num">{num}</span>
                {month}
                {isHoliday && (
                  <span className="holiday-badge" title={holiday.reason || "No college"}>
                    Off
                  </span>
                )}
              </div>
              <div className="planner-items">
                {!hasItems && <span style={{ color: "var(--text-muted)", fontSize: 13 }}>—</span>}

                {/* NPTEL Assignment Cards */}
                {dayNptelAssignments.map((a) => (
                  <div
                    key={a.id}
                    className={"todo-item" + (a.submitted ? " done" : "")}
                    style={{
                      borderLeft: "3px solid #8b5cf6",
                      background: a.submitted ? "rgba(139, 92, 246, 0.05)" : "rgba(139, 92, 246, 0.12)",
                      padding: "6px 12px",
                      borderRadius: 8,
                      marginBottom: 6,
                    }}
                  >
                    <input
                      type="checkbox"
                      className="custom-checkbox"
                      checked={a.submitted}
                      onChange={async () => {
                        const { ok } = await run(
                          () => api.put(`/nptel/assignments/${a.id}`, { submitted: !a.submitted }),
                          { errorMessage: "Couldn't update that assignment" }
                        );
                        if (ok) await run(refresh, { errorMessage: "Saved, but the list may be out of date" });
                      }}
                    />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>
                      <strong style={{ color: "#8b5cf6" }}>📘 NPTEL:</strong> {a.course_name} — {a.title}
                    </span>
                    <Link
                      to="/nptel"
                      style={{ fontSize: 11, color: "#8b5cf6", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}
                    >
                      Tracker →
                    </Link>
                  </div>
                ))}

                {/* Subscription Reminder Cards */}
                {subEvents.map((evt) => (
                  <div
                    key={`${evt.sub.id}-${evt.type}`}
                    className="todo-item"
                    style={{
                      borderLeft: evt.isTrial ? "3px solid var(--warning)" : "3px solid #3b82f6",
                      background: evt.isTrial ? "rgba(234, 179, 8, 0.08)" : "rgba(59, 130, 246, 0.08)",
                      padding: "6px 12px",
                      borderRadius: 8,
                      marginBottom: 6,
                    }}
                  >
                    <CreditCard size={16} style={{ color: evt.isTrial ? "var(--warning)" : "#3b82f6", flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>
                      {evt.type === "renewal_day" ? (
                        <>
                          <strong style={{ color: evt.isTrial ? "var(--warning)" : "var(--text)" }}>
                            {evt.isTrial ? "🚨 Free Trial Ends Today!" : "💳 Subscription Renews Today:"}
                          </strong>{" "}
                          {evt.sub.name} ({evt.sub.currency}{evt.sub.amount}/{evt.sub.billing_cycle})
                        </>
                      ) : (
                        <>
                          <strong>⚠️ Subscription Alert:</strong> {evt.sub.name}{" "}
                          {evt.isTrial ? "trial ends" : "renews"} in {evt.sub.remind_days_before} days ({evt.sub.currency}{evt.sub.amount})
                        </>
                      )}
                    </span>
                    <Link
                      to="/subscriptions"
                      style={{ fontSize: 11, color: "var(--primary-color)", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}
                    >
                      View / Cancel →
                    </Link>
                  </div>
                ))}

                {/* Todo Items */}
                {dayTodos.map((t) => (
                  <div key={t.id} className={"todo-item" + (t.done ? " done" : "")}>
                    <input type="checkbox" className="custom-checkbox" checked={t.done} onChange={() => toggleDone(t)} />
                    <span className={`priority-dot priority-${t.priority}`} />
                    <span style={{ flex: 1 }}>{t.text}</span>
                    <button
                      onClick={() => setEditingTodo(t)}
                      className="todo-action-btn"
                      aria-label="Edit task"
                      title="Edit"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => removeTodo(t.id)}
                      className="todo-action-btn todo-delete-btn"
                      aria-label="Delete task"
                      title="Delete"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
