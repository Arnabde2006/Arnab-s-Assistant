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
  const [streamingText, setStreamingText] = useState(""); // live token buffer
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, streamingText]);

  const suggestions = [
    "Am I safe to miss class tomorrow?",
    "What exams are coming up?",
    "List my urgent to-dos",
    "How is my CGPA?"
  ];

  async function handleSend(textToSend) {
    const text = textToSend.trim();
    if (!text || loading) return;
    const nextMessages = [...messages, { role: "user", text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setStreamingText("");

    try {
      let accumulated = "";

      await api.postStream(
        "/ai/chat",
        { message: text, history: nextMessages.slice(-8) },
        {
          onChunk: (chunk) => {
            accumulated += chunk;
            setStreamingText(accumulated);
          },
          onDone: (finalReply) => {
            // Replace streaming buffer with final committed message
            setStreamingText("");
            setMessages((m) => [...m, { role: "assistant", text: finalReply || accumulated }]);
          },
          onError: (err) => {
            setStreamingText("");
            setMessages((m) => [...m, { role: "assistant", text: `Sorry, I couldn't get an answer (${err.message}).` }]);
          },
        }
      );
    } catch (err) {
      setStreamingText("");
      setMessages((m) => [...m, { role: "assistant", text: `Sorry, I couldn't get an answer (${err.message}).` }]);
    } finally {
      setLoading(false);
    }
  }

  function send(e) {
    e.preventDefault();
    handleSend(input);
  }

  function formatMessage(text) {
    if (!text) return "";
    let escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    escaped = escaped.replace(/`(.*?)`/g, "<code>$1</code>");
    
    const lines = escaped.split("\n").map(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
        return `<li style="margin-left: 16px; margin-bottom: 4px;">${trimmed.substring(2)}</li>`;
      }
      return line;
    });
    
    return lines.join("<br />");
  }

  return (
    <div className="card">
      <div className="label" style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "var(--accent)" }}>✦</span> Ask Arnab's Assistant AI
      </div>
      
      <div ref={scrollRef} className="chat-container">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`chat-bubble ${m.role}`}
            dangerouslySetInnerHTML={{ __html: formatMessage(m.text) }}
          />
        ))}

        {/* Live streaming bubble — shows text as it arrives */}
        {loading && streamingText && (
          <div
            className="chat-bubble assistant"
            dangerouslySetInnerHTML={{
              __html: formatMessage(streamingText) + '<span class="chat-cursor">▋</span>',
            }}
          />
        )}

        {/* Dot animation while waiting for first token */}
        {loading && !streamingText && (
          <div className="chat-loading">
            <span className="chat-loading-dot" />
            <span className="chat-loading-dot" />
            <span className="chat-loading-dot" />
          </div>
        )}
      </div>

      <div className="chat-suggestion-container">
        {suggestions.map((s, idx) => (
          <button
            key={idx}
            type="button"
            className="chat-suggestion-pill"
            onClick={() => handleSend(s)}
            disabled={loading}
          >
            {s}
          </button>
        ))}
      </div>

      <form onSubmit={send} style={{ display: "flex", gap: 8 }}>
        <input
          className="input"
          placeholder="Ask a question..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{ minWidth: 0 }}
          disabled={loading}
        />
        <button className="btn" type="submit" disabled={loading || !input.trim()} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
          <span>Send</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
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
