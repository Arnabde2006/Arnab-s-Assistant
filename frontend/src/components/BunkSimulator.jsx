import React, { useState } from "react";
import {
  Target,
  Sliders,
  RotateCcw,
  Coffee,
  BookOpen,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  BarChart2,
} from "lucide-react";
import AttendanceRing from "./AttendanceRing.jsx";

const TARGET_PRESETS = [60, 75, 80, 85, 90];

// ── Visual Attendance Trajectory Chart Component ──────────────────────────────
function AttendanceTrajectoryChart({ currentTotal, currentPresent, targetGoal, daysToBunk, daysToAttend }) {
  const points = [];

  // Baseline current point
  const curPct = currentTotal === 0 ? 0 : Math.round(((currentPresent / currentTotal) * 100) * 10) / 10;
  points.push({
    step: 0,
    label: "Now",
    pct: curPct,
  });

  const totalActions = daysToBunk + daysToAttend;
  if (totalActions > 0) {
    const steps = 4;
    for (let i = 1; i <= steps; i++) {
      const stepBunks = (daysToBunk / steps) * i;
      const stepAttends = (daysToAttend / steps) * i;
      const t = currentTotal + stepBunks + stepAttends;
      const p = currentPresent + stepAttends;
      const pct = t === 0 ? 0 : Math.round(((p / t) * 100) * 10) / 10;
      points.push({
        step: i,
        label: i === steps ? "Final" : `+${Math.round(stepBunks + stepAttends)}d`,
        pct,
      });
    }
  }

  const svgW = 540;
  const svgH = 160;
  const padL = 40;
  const padR = 75;
  const padT = 26;
  const padB = 30;
  const chartW = svgW - padL - padR;
  const chartH = svgH - padT - padB;

  const getY = (val) => padT + (1 - Math.min(100, Math.max(0, val)) / 100) * chartH;
  const getX = (idx) => padL + (idx / Math.max(1, points.length - 1)) * chartW;

  const targetY = getY(targetGoal);

  let pathD = "";
  points.forEach((pt, idx) => {
    pathD += idx === 0 ? `M ${getX(idx)} ${getY(pt.pct)}` : ` L ${getX(idx)} ${getY(pt.pct)}`;
  });

  return (
    <div style={{ width: "100%", overflowX: "auto", position: "relative", WebkitOverflowScrolling: "touch" }}>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: "100%", height: "auto", minWidth: 380, overflow: "visible" }}>
        {/* Y Grid lines */}
        {[100, 75, 50, 25, 0].map((val) => (
          <g key={val}>
            <line x1={padL} y1={getY(val)} x2={svgW - padR} y2={getY(val)} stroke="var(--border)" strokeDasharray="3 3" strokeWidth="1" />
            <text x={padL - 6} y={getY(val) + 3} textAnchor="end" fill="var(--text-muted)" style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}>
              {val}%
            </text>
          </g>
        ))}

        {/* Target Goal Reference Line */}
        <line x1={padL} y1={targetY} x2={svgW - padR} y2={targetY} stroke="var(--accent)" strokeDasharray="4 4" strokeWidth="1.5" />
        <text x={svgW - padR + 6} y={targetY + 3} fill="var(--accent)" style={{ fontSize: 10, fontWeight: 600, fontFamily: "var(--font-mono)" }}>
          Goal ({targetGoal}%)
        </text>

        {/* Trajectory Path Line */}
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke={points[points.length - 1].pct >= targetGoal ? "var(--present)" : "var(--absent)"}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Nodes & Value Badges */}
        {points.map((pt, idx) => {
          const x = getX(idx);
          const y = getY(pt.pct);
          const isGood = pt.pct >= targetGoal;

          return (
            <g key={idx}>
              <circle cx={x} cy={y} r="5" fill="var(--panel)" stroke={isGood ? "var(--present)" : "var(--absent)"} strokeWidth="2.5" />
              <text x={x} y={y - 10} textAnchor="middle" fill={isGood ? "var(--present)" : "var(--absent)"} style={{ fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                {pt.pct}%
              </text>
              <text x={x} y={svgH - 8} textAnchor="middle" fill="var(--text-muted)" style={{ fontSize: 10 }}>
                {pt.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────
export default function BunkSimulator({ summary }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const [targetGoal, setTargetGoal] = useState(summary?.goal || 75);
  const [daysToBunk, setDaysToBunk] = useState(0);
  const [daysToAttend, setDaysToAttend] = useState(0);

  if (!summary) return null;

  const currentTotal = summary.total;
  const currentPresent = summary.present + summary.halfDay * 0.5;

  const simTotal = currentTotal + daysToBunk + daysToAttend;
  const simPresent = currentPresent + daysToAttend;
  const simPercentage = simTotal === 0 ? 0 : Math.round(((simPresent / simTotal) * 100) * 10) / 10;

  // Calculate safe bunks under simulated state
  const safeBunks = Math.max(0, Math.floor((simPresent * 100) / targetGoal - simTotal));

  // Calculate recovery days needed if below targetGoal
  const g = targetGoal / 100;
  const daysNeeded = simPercentage < targetGoal && g < 1
    ? Math.max(0, Math.ceil((g * simTotal - simPresent) / (1 - g)))
    : 0;

  // College Points calculation (2 pts per day)
  const currentCollegeEarned = summary.college?.earnedPoints || 0;
  const currentCollegeMax = summary.college?.maxPoints || 0;
  const simCollegeEarned = currentCollegeEarned + daysToAttend * 2;
  const simCollegeMax = currentCollegeMax + (daysToAttend + daysToBunk) * 2;
  const simCollegePercentage = simCollegeMax === 0 ? 0 : Math.round(((simCollegeEarned / simCollegeMax) * 100) * 10) / 10;

  const isMeetingGoal = simTotal === 0 || simPercentage >= targetGoal;
  const ringColor = simTotal === 0 ? "var(--accent)" : isMeetingGoal ? "var(--present)" : "var(--absent)";
  const percentageDelta = Math.round((simPercentage - summary.percentage) * 10) / 10;

  const resetSimulation = () => {
    setDaysToBunk(0);
    setDaysToAttend(0);
    setTargetGoal(summary.goal || 75);
  };

  if (!isOpen) {
    return (
      <div
        className="card"
        style={{
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          flexWrap: "wrap",
          padding: "16px 20px",
          background: "var(--panel)",
          border: "1px solid var(--border)",
          transition: "all 0.2s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, flex: "1 1 260px" }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "var(--accent-soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent)",
              flexShrink: 0,
            }}
          >
            <Target size={22} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              Smart Bunk Predictor & Attendance Simulator
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              Simulate future bunks/attends, test target goals, and forecast attendance recovery.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="btn"
          onClick={() => setIsOpen(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            padding: "8px 16px",
            background: "var(--accent)",
            color: "var(--accent-text)",
            borderRadius: 10,
            cursor: "pointer",
            fontWeight: 500,
            width: "100%",
            maxWidth: "max-content",
          }}
        >
          <Sliders size={16} />
          Open Simulator
          <ChevronDown size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: 20, position: "relative", overflow: "hidden" }}>
      {/* Top Header Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Target size={20} color="var(--accent)" />
          <div>
            <div className="label" style={{ fontSize: 16, fontWeight: 600 }}>
              Smart Bunk Predictor & Attendance Simulator
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              Simulate future class bunks/attends and forecast your attendance status in real-time.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* Optional Graph Toggle Button */}
          <button
            type="button"
            className="btn"
            onClick={() => setShowGraph((v) => !v)}
            style={{
              fontSize: 12,
              padding: "6px 12px",
              background: showGraph ? "var(--accent-soft)" : "var(--bg-elevated)",
              border: `1px solid ${showGraph ? "var(--accent)" : "var(--border-strong)"}`,
              color: showGraph ? "var(--accent)" : "var(--text)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <BarChart2 size={14} />
            {showGraph ? "Hide Graph" : "Show Graph"}
          </button>

          {(daysToBunk > 0 || daysToAttend > 0 || targetGoal !== summary.goal) && (
            <button
              className="btn"
              onClick={resetSimulation}
              style={{
                fontSize: 12,
                padding: "6px 12px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-strong)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <RotateCcw size={14} />
              Reset
            </button>
          )}
          <button
            type="button"
            className="btn"
            onClick={() => setIsOpen(false)}
            style={{
              fontSize: 12,
              padding: "6px 12px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-strong)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            Close
            <ChevronUp size={14} />
          </button>
        </div>
      </div>

      {/* Visual Trajectory Graph — Optional View */}
      {showGraph && (
        <div style={{ marginBottom: 20, background: "var(--bg-elevated)", padding: 16, borderRadius: 12, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <BarChart2 size={16} color="var(--accent)" />
            Simulated Attendance Trajectory Graph
          </div>
          <AttendanceTrajectoryChart
            currentTotal={currentTotal}
            currentPresent={currentPresent}
            targetGoal={targetGoal}
            daysToBunk={daysToBunk}
            daysToAttend={daysToAttend}
          />
        </div>
      )}

      {/* Target Goal Presets Selector */}
      <div style={{ marginBottom: 20, background: "var(--bg-elevated)", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
            <Sparkles size={16} color="var(--accent)" />
            Target Attendance Goal:
          </span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {TARGET_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setTargetGoal(preset)}
                style={{
                  fontSize: 12,
                  fontWeight: targetGoal === preset ? 600 : 400,
                  padding: "6px 12px",
                  minHeight: 34,
                  borderRadius: 8,
                  border: `1px solid ${targetGoal === preset ? "var(--accent)" : "var(--border)"}`,
                  background: targetGoal === preset ? "var(--accent)" : "transparent",
                  color: targetGoal === preset ? "var(--accent-text)" : "var(--text-muted)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {preset}%
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ gap: 20, alignItems: "start" }}>
        {/* Controls Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Days to Bunk Slider */}
          <div style={{ background: "var(--bg-elevated)", padding: 16, borderRadius: 12, border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--absent)", display: "flex", alignItems: "center", gap: 6 }}>
                <Coffee size={16} />
                Upcoming Days to Bunk:
              </span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--absent)" }}>+{daysToBunk} day{daysToBunk !== 1 ? "s" : ""}</span>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              value={daysToBunk}
              onChange={(e) => setDaysToBunk(Number(e.target.value))}
              style={{ width: "100%", height: 24, accentColor: "var(--absent)", cursor: "pointer" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              <span>0 days</span>
              <span>15 days</span>
              <span>30 days</span>
            </div>
          </div>

          {/* Days to Attend Slider */}
          <div style={{ background: "var(--bg-elevated)", padding: 16, borderRadius: 12, border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--present)", display: "flex", alignItems: "center", gap: 6 }}>
                <BookOpen size={16} />
                Upcoming Days to Attend:
              </span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--present)" }}>+{daysToAttend} day{daysToAttend !== 1 ? "s" : ""}</span>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              value={daysToAttend}
              onChange={(e) => setDaysToAttend(Number(e.target.value))}
              style={{ width: "100%", height: 24, accentColor: "var(--present)", cursor: "pointer" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              <span>0 days</span>
              <span>15 days</span>
              <span>30 days</span>
            </div>
          </div>
        </div>

        {/* Forecast Output Column */}
        <div style={{ background: "var(--bg-elevated)", padding: 20, borderRadius: 16, border: `1px solid ${ringColor}`, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <AttendanceRing
              percentage={simPercentage}
              color={ringColor}
              size={90}
            />
            <div style={{ flex: "1 1 140px" }}>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-muted)" }}>Projected Attendance</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: ringColor }}>
                {simPercentage}%
                {(daysToBunk > 0 || daysToAttend > 0) && (
                  <span style={{ fontSize: 13, fontWeight: 500, marginLeft: 8, color: percentageDelta >= 0 ? "var(--present)" : "var(--absent)" }}>
                    ({percentageDelta >= 0 ? `+${percentageDelta}` : percentageDelta}%)
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                {simPresent} / {simTotal} total days
              </div>
            </div>
          </div>

          {/* Smart Predictor Insights Badges */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {simTotal === 0 ? (
              <div style={{ padding: "8px 12px", background: "var(--accent-soft)", border: "1px solid var(--accent)", borderRadius: 8, fontSize: 13, color: "var(--text)", display: "flex", gap: 8, alignItems: "center" }}>
                <Sparkles size={18} color="var(--accent)" style={{ flexShrink: 0 }} />
                <div>
                  <strong>Get Started:</strong> No attendance recorded yet. Mark your attendance below or adjust the sliders above to simulate your schedule!
                </div>
              </div>
            ) : isMeetingGoal ? (
              <div style={{ padding: "8px 12px", background: "rgba(79, 168, 138, 0.12)", border: "1px solid var(--present)", borderRadius: 8, fontSize: 13, color: "var(--text)", display: "flex", gap: 8, alignItems: "start" }}>
                <CheckCircle2 size={18} color="var(--present)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong>Safe Buffer:</strong> You can safely miss <strong>{safeBunks}</strong> more consecutive day(s) and stay above your {targetGoal}% target.
                </div>
              </div>
            ) : (
              <div style={{ padding: "8px 12px", background: "rgba(193, 85, 74, 0.12)", border: "1px solid var(--absent)", borderRadius: 8, fontSize: 13, color: "var(--text)", display: "flex", gap: 8, alignItems: "start" }}>
                <AlertTriangle size={18} color="var(--absent)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong>Goal Alert:</strong> You are below your {targetGoal}% target. You must attend the next <strong>{daysNeeded}</strong> consecutive day(s) without bunking to recover.
                </div>
              </div>
            )}

            <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
              <span>College Points Forecast (2 pts/day):</span>
              <strong style={{ color: "var(--text)" }}>{simCollegePercentage}% ({simCollegeEarned}/{simCollegeMax} pts)</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
