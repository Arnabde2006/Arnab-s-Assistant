import React, { useEffect, useRef, useState } from "react";

const MODES = {
  focus: { label: "Focus", minutes: 25, color: "var(--accent)" },
  short: { label: "Short break", minutes: 5, color: "var(--present)" },
  long: { label: "Long break", minutes: 15, color: "#7A8FC1" },
};

export default function Pomodoro() {
  const [mode, setMode] = useState("focus");
  const [secondsLeft, setSecondsLeft] = useState(MODES.focus.minutes * 60);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    setSecondsLeft(MODES[mode].minutes * 60);
    setRunning(false);
  }, [mode]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            if (mode === "focus") setSessions((n) => n + 1);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, mode]);

  const total = MODES[mode].minutes * 60;
  const progress = 1 - secondsLeft / total;
  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const secs = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Focus timer</h1>
          <p className="page-subtitle">A simple Pomodoro to structure study blocks.</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 380, textAlign: "center", padding: 32 }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {Object.keys(MODES).map((m) => (
            <button
              key={m}
              className={m === mode ? "btn" : "btn-ghost btn"}
              style={{ fontSize: 12, padding: "6px 12px" }}
              onClick={() => setMode(m)}
            >
              {MODES[m].label}
            </button>
          ))}
        </div>

        <svg width="200" height="200" style={{ margin: "0 auto", display: "block" }}>
          <circle cx="100" cy="100" r="88" fill="none" stroke="var(--border)" strokeWidth="10" />
          <circle
            cx="100"
            cy="100"
            r="88"
            fill="none"
            stroke={MODES[mode].color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 88}
            strokeDashoffset={2 * Math.PI * 88 * (1 - progress)}
            transform="rotate(-90 100 100)"
            style={{ transition: "stroke-dashoffset 1s linear" }}
          />
          <text x="100" y="108" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="34" fontWeight="700" fill="var(--text)">
            {mins}:{secs}
          </text>
        </svg>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 24 }}>
          <button className="btn" onClick={() => setRunning((r) => !r)}>
            {running ? "Pause" : "Start"}
          </button>
          <button className="btn-ghost btn" onClick={() => { setRunning(false); setSecondsLeft(MODES[mode].minutes * 60); }}>
            Reset
          </button>
        </div>

        <p style={{ marginTop: 20, color: "var(--text-muted)", fontSize: 13 }}>
          {sessions} focus session{sessions === 1 ? "" : "s"} completed today
        </p>
      </div>
    </div>
  );
}
