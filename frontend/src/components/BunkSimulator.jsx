import React, { useState } from "react";
import AttendanceRing from "./AttendanceRing.jsx";

const TARGET_PRESETS = [60, 75, 80, 85, 90];

export default function BunkSimulator({ summary }) {
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

  const isMeetingGoal = simPercentage >= targetGoal;
  const percentageDelta = Math.round((simPercentage - summary.percentage) * 10) / 10;

  const resetSimulation = () => {
    setDaysToBunk(0);
    setDaysToAttend(0);
    setTargetGoal(summary.goal || 75);
  };

  return (
    <div className="card" style={{ marginBottom: 20, position: "relative", overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div className="label" style={{ fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
            🎯 Smart Bunk Predictor & Attendance Simulator
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
            Simulate future class bunks/attends and forecast your attendance status in real-time.
          </p>
        </div>
        {(daysToBunk > 0 || daysToAttend > 0 || targetGoal !== summary.goal) && (
          <button
            className="btn"
            onClick={resetSimulation}
            style={{ fontSize: 12, padding: "4px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)" }}
          >
            ↺ Reset
          </button>
        )}
      </div>

      {/* Target Goal Presets Selector */}
      <div style={{ marginBottom: 20, background: "var(--bg-elevated)", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Target Attendance Goal:</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {TARGET_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setTargetGoal(preset)}
                style={{
                  fontSize: 12,
                  fontWeight: targetGoal === preset ? 600 : 400,
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: `1px solid ${targetGoal === preset ? "var(--accent)" : "var(--border)"}`,
                  background: targetGoal === preset ? "var(--accent)" : "transparent",
                  color: targetGoal === preset ? "var(--accent-text)" : "var(--text-muted)",
                  cursor: "pointer",
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--absent)", display: "flex", alignItems: "center", gap: 6 }}>
                😴 Upcoming Days to Bunk:
              </span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--absent)" }}>+{daysToBunk} day{daysToBunk !== 1 ? "s" : ""}</span>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              value={daysToBunk}
              onChange={(e) => setDaysToBunk(Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--absent)", cursor: "pointer" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              <span>0 days</span>
              <span>15 days</span>
              <span>30 days</span>
            </div>
          </div>

          {/* Days to Attend Slider */}
          <div style={{ background: "var(--bg-elevated)", padding: 16, borderRadius: 12, border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--present)", display: "flex", alignItems: "center", gap: 6 }}>
                📚 Upcoming Days to Attend:
              </span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--present)" }}>+{daysToAttend} day{daysToAttend !== 1 ? "s" : ""}</span>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              value={daysToAttend}
              onChange={(e) => setDaysToAttend(Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--present)", cursor: "pointer" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              <span>0 days</span>
              <span>15 days</span>
              <span>30 days</span>
            </div>
          </div>
        </div>

        {/* Forecast Output Column */}
        <div style={{ background: "var(--bg-elevated)", padding: 20, borderRadius: 16, border: `1px solid ${isMeetingGoal ? "var(--present)" : "var(--absent)"}`, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <AttendanceRing
              percentage={simPercentage}
              color={isMeetingGoal ? "var(--present)" : "var(--absent)"}
              size={90}
            />
            <div style={{ flexGrow: 1 }}>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-muted)" }}>Projected Attendance</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: isMeetingGoal ? "var(--present)" : "var(--absent)" }}>
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
            {isMeetingGoal ? (
              <div style={{ padding: "8px 12px", background: "rgba(79, 168, 138, 0.12)", border: "1px solid var(--present)", borderRadius: 8, fontSize: 13, color: "var(--text)" }}>
                🎉 <strong>Safe Buffer:</strong> You can safely miss <strong>{safeBunks}</strong> more consecutive day(s) and stay above your {targetGoal}% target.
              </div>
            ) : (
              <div style={{ padding: "8px 12px", background: "rgba(193, 85, 74, 0.12)", border: "1px solid var(--absent)", borderRadius: 8, fontSize: 13, color: "var(--text)" }}>
                ⚠️ <strong>Goal Alert:</strong> You are below your {targetGoal}% target. You must attend the next <strong>{daysNeeded}</strong> consecutive day(s) without bunking to recover.
              </div>
            )}

            <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>College Points Forecast (2 pts/day):</span>
              <strong style={{ color: "var(--text)" }}>{simCollegePercentage}% ({simCollegeEarned}/{simCollegeMax} pts)</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
