import React, { useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import AttendanceRing from "../components/AttendanceRing.jsx";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [todayTodos, setTodayTodos] = useState([]);
  const [upcomingExams, setUpcomingExams] = useState([]);

  const todayStr = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    api.get("/dashboard").then(setStats).catch(() => {});
    api.get("/attendance/summary").then(setAttendance).catch(() => {});
    api.get(`/todos?from=${todayStr}&to=${todayStr}`).then((d) => setTodayTodos(d.todos)).catch(() => {});
    api.get("/ai/exams").then((d) => setUpcomingExams(d.exams.filter((e) => e.exam_date >= todayStr).slice(0, 4))).catch(() => {});
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {greeting()}, {user?.name?.split(" ")[0] || "there"}
          </h1>
          <p className="page-subtitle">Here's where things stand today.</p>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="label">Task streak</div>
          <div className="stat-num">{stats?.taskStreak ?? "—"}</div>
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>days fully cleared</div>
        </div>
        <div className="card">
          <div className="label">Attendance streak</div>
          <div className="stat-num">{stats?.attendanceStreak ?? "—"}</div>
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>days marked present</div>
        </div>
        <div className="card">
          <div className="label">Pending today</div>
          <div className="stat-num">{stats?.pendingToday ?? "—"}</div>
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>{stats?.totalPendingUpcoming ?? 0} upcoming in total</div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <div className="card" style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <AttendanceRing
            percentage={attendance?.percentage || 0}
            color={attendance && attendance.percentage >= attendance.goal ? "var(--present)" : "var(--absent)"}
          />
          <div>
            <div className="label" style={{ marginBottom: 4 }}>Attendance</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {attendance ? `${attendance.present} present · ${attendance.halfDay} half days · ${attendance.absent} absent` : "No records yet"}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="label" style={{ marginBottom: 14 }}>Today's list</div>
          {todayTodos.length === 0 && <div className="empty-state">Nothing on today's list yet.</div>}
          {todayTodos.map((t) => (
            <div key={t.id} className={"todo-item" + (t.done ? " done" : "")}>
              <span className={`priority-dot priority-${t.priority}`} />
              {t.text}
            </div>
          ))}
        </div>
      </div>

      {upcomingExams.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="label" style={{ marginBottom: 10 }}>Upcoming exams</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {upcomingExams.map((e) => (
              <div key={e.id} style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-elevated)", fontSize: 13 }}>
                <strong>{e.course}</strong> · {e.exam_date}{e.exam_time ? ` · ${e.exam_time}` : ""}
              </div>
            ))}
          </div>
        </div>
      )}

      <ChatCard />
      <div style={{ height: 20 }} />
      <ViewLinkCard />
    </div>
  );
}

function ViewLinkCard() {
  const { user, setUser } = useAuth();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!user?.viewToken) return null;

  const link = `${window.location.origin}/view/${user.viewToken}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — user can still select and copy manually
    }
  }

  async function regenerate() {
    if (!confirm("This will invalidate your old view-only link. Continue?")) return;
    setLoading(true);
    try {
      const data = await api.post("/auth/view-token/regenerate", {});
      setUser(data.user);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="label" style={{ marginBottom: 8 }}>Your view-only link</div>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
        Bookmark this to check your attendance and calendar instantly — no login, no editing.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input className="input" readOnly value={link} onFocus={(e) => e.target.select()} style={{ flex: "1 1 200px", minWidth: 0 }} />
        <button className="btn" onClick={copy} type="button">{copied ? "Copied!" : "Copy"}</button>
        <button className="btn-ghost btn" onClick={regenerate} type="button" disabled={loading}>Regenerate</button>
      </div>
    </div>
  );
}

function ChatCard() {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hi! Ask me anything about your classes, attendance, tasks, or exams." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    const nextMessages = [...messages, { role: "user", text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const data = await api.post("/ai/chat", {
        message: text,
        history: nextMessages.slice(-8),
      });
      setMessages((m) => [...m, { role: "assistant", text: data.reply }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", text: `Sorry, I couldn't get an answer (${err.message}).` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="label" style={{ marginBottom: 10 }}>Ask Arnab's Assistant AI</div>
      <div ref={scrollRef} style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "80%",
              background: m.role === "user" ? "var(--accent-soft)" : "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "8px 12px",
              fontSize: 14,
            }}
          >
            {m.text}
          </div>
        ))}
        {loading && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Thinking…</div>}
      </div>
      <form onSubmit={send} style={{ display: "flex", gap: 8 }}>
        <input
          className="input"
          placeholder="e.g. Am I safe to miss class tomorrow?"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{ minWidth: 0 }}
        />
        <button className="btn" type="submit" disabled={loading} style={{ flexShrink: 0 }}>Send</button>
      </form>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
