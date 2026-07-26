import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import Switch from "../components/Switch.jsx";
import { CreditCard, AlertTriangle } from "lucide-react";

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

export default function Todos() {
  const [note, setNote] = useState("");
  const [priority, setPriority] = useState("normal");
  const [todos, setTodos] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [nptelAssignments, setNptelAssignments] = useState([]);
  const [showHolidays, setShowHolidays] = useState(() => localStorage.getItem("showHolidays") !== "false");
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    localStorage.setItem("showHolidays", String(showHolidays));
  }, [showHolidays]);

  const rangeStart = toISO(new Date());
  const rangeEndDate = new Date();
  rangeEndDate.setDate(rangeEndDate.getDate() + 60); // fetch a wide window; exams can be weeks out
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
    refresh().catch(() => {});
  }, []);

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
    await api.post("/todos", { text: note.trim(), priority });
    setNote("");
    setPriority("normal");
    refresh();
  }

  async function toggleDone(todo) {
    await api.put(`/todos/${todo.id}`, { done: !todo.done });
    refresh();
  }

  async function removeTodo(id) {
    await api.del(`/todos/${id}`);
    refresh();
  }

  // Active subscriptions mapping by date
  const activeSubs = subscriptions.filter((s) => s.status === "active");

  // Determine furthest date between todos & subscriptions
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

  const holidayMap = new Map(holidays.map((h) => [h.date, h]));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">To‑do &amp; Calendar</h1>
          <p className="page-subtitle">Type a note — it lands on the right day automatically. Subscription &amp; trial reminders display automatically.</p>
        </div>
        <Switch checked={showHolidays} onChange={setShowHolidays} label="Show college‑off days" />
      </div>

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
        <button className="btn" type="submit">Add</button>
      </form>

      <div className="planner">
        {days.map((date) => {
          const dayTodos = todos.filter((t) => t.date === date);
          const holiday = holidayMap.get(date);
          const isHoliday = showHolidays && !!holiday;
          const { weekday, num, month } = formatDay(date);

          // Find active subscription events for this date
          const subEvents = [];
          for (const sub of activeSubs) {
            if (!sub.renewal_date) continue;
            const renDateStr = sub.renewal_date.split("T")[0];

            // Trigger event on renewal_date itself
            if (renDateStr === date) {
              subEvents.push({
                sub,
                type: "renewal_day",
                isTrial: sub.plan_type === "free_trial",
              });
            } else {
              // Trigger reminder N days before
              const renDateObj = new Date(renDateStr + "T00:00:00");
              const remindDateObj = new Date(renDateObj);
              remindDateObj.setDate(remindDateObj.getDate() - (sub.remind_days_before || 3));
              const remindDateStr = toISO(remindDateObj);

              if (remindDateStr === date) {
                subEvents.push({
                  sub,
                  type: "reminder_day",
                  isTrial: sub.plan_type === "free_trial",
                });
              }
            }
          }

          // Find NPTEL assignment events for this date
          const dayNptelAssignments = nptelAssignments.filter((a) => a.due_date && a.due_date.split("T")[0] === date);

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
                        await api.put(`/nptel/assignments/${a.id}`, { submitted: !a.submitted });
                        refresh();
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

                {/* Todos */}
                {dayTodos.map((t) => (
                  <div key={t.id} className={"todo-item" + (t.done ? " done" : "")}>
                    <input type="checkbox" className="custom-checkbox" checked={t.done} onChange={() => toggleDone(t)} />
                    <span className={`priority-dot priority-${t.priority}`} />
                    <span style={{ flex: 1 }}>{t.text}</span>
                    <button
                      onClick={() => removeTodo(t.id)}
                      style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 14, padding: 8, minWidth: 32, minHeight: 32 }}
                      aria-label="Delete task"
                    >
                      ✕
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

