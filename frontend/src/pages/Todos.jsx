import React, { useEffect, useState } from "react";
import { api } from "../api/client.js";
import Switch from "../components/Switch.jsx";

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
  const [showHolidays, setShowHolidays] = useState(() => localStorage.getItem("showHolidays") !== "false");

  useEffect(() => {
    localStorage.setItem("showHolidays", String(showHolidays));
  }, [showHolidays]);

  const rangeStart = toISO(new Date());
  const rangeEndDate = new Date();
  rangeEndDate.setDate(rangeEndDate.getDate() + 60); // fetch a wide window; exams can be weeks out
  const rangeEnd = toISO(rangeEndDate);

  async function refresh() {
    const [todosData, holidaysData] = await Promise.all([
      api.get(`/todos?from=${rangeStart}&to=${rangeEnd}`),
      api.get(`/holidays?from=${rangeStart}&to=${rangeEnd}`),
    ]);
    setTodos(todosData.todos);
    setHolidays(holidaysData.holidays);
  }

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

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

  // Build the visible day window: at least 14 days, extended further if a
  // todo (e.g. an auto-added exam) falls beyond that — so exams always show.
  const furthestDate = todos.reduce((max, t) => (t.date > max ? t.date : max), rangeStart);
  const daysCount = Math.max(
    14,
    Math.round((new Date(furthestDate) - new Date(rangeStart)) / 86400000) + 1
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
          <p className="page-subtitle">Type a note — it lands on the right day automatically. Try "submit lab report fri".</p>
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
                {dayTodos.length === 0 && <span style={{ color: "var(--text-muted)", fontSize: 13 }}>—</span>}
                {dayTodos.map((t) => (
                  <div key={t.id} className={"todo-item" + (t.done ? " done" : "")}>
                    <input type="checkbox" checked={t.done} onChange={() => toggleDone(t)} style={{ width: 18, height: 18, flexShrink: 0 }} />
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
