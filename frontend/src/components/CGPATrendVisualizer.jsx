import React, { useState } from "react";
import {
  TrendingUp,
  Award,
  Sliders,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  BookOpen,
} from "lucide-react";

const TARGET_PRESETS = [7.0, 7.5, 8.0, 8.5, 9.0, 9.5];

export default function CGPATrendVisualizer({ data }) {
  const [isOpen, setIsOpen] = useState(false);
  const [targetCGPA, setTargetCGPA] = useState(8.5);
  const [futureSemesters, setFutureSemesters] = useState(2);
  const [simulatedFutureSGPA, setSimulatedFutureSGPA] = useState(8.0);

  if (!data || !data.semesters) return null;

  const semesters = data.semesters || [];
  const currentCGPA = data.cgpa || 0;
  const currentCredits = data.totalCredits || (semesters.length * 20) || 0;
  const currentPoints = currentCGPA * currentCredits;

  // Calculate historical cumulative CGPA trend per semester
  let accumCredits = 0;
  let accumPoints = 0;
  const historyTrend = semesters.map((s, idx) => {
    const creds = s.totalCredits || 20;
    accumCredits += creds;
    accumPoints += (s.sgpa || 0) * creds;
    const runningCGPA = Math.round((accumPoints / accumCredits) * 100) / 100;
    return {
      semester: s.semester || `Sem ${idx + 1}`,
      sgpa: s.sgpa || 0,
      runningCGPA,
      credits: creds,
    };
  });

  // Future simulation calculation
  const futureCreditsPerSem = 20;
  const totalFutureCredits = futureSemesters * futureCreditsPerSem;
  const totalSimulatedCredits = currentCredits + totalFutureCredits;

  // Required average SGPA to reach target CGPA
  const requiredTotalPoints = targetCGPA * totalSimulatedCredits;
  const requiredFuturePoints = requiredTotalPoints - currentPoints;
  const rawRequiredSGPA = totalFutureCredits > 0 ? requiredFuturePoints / totalFutureCredits : 0;
  const requiredSGPA = Math.round(rawRequiredSGPA * 100) / 100;

  const isAchievable = rawRequiredSGPA <= 10.0;
  const isAlreadyAchieved = currentCredits > 0 && currentCGPA >= targetCGPA;

  // Projected CGPA based on future SGPA slider
  const simFuturePoints = simulatedFutureSGPA * totalFutureCredits;
  const projectedTotalPoints = currentPoints + simFuturePoints;
  const projectedCGPA = totalSimulatedCredits > 0 ? Math.round((projectedTotalPoints / totalSimulatedCredits) * 100) / 100 : 0;
  const cgpaDelta = Math.round((projectedCGPA - currentCGPA) * 100) / 100;

  const resetSimulation = () => {
    setTargetCGPA(8.5);
    setFutureSemesters(2);
    setSimulatedFutureSGPA(8.0);
  };

  const maxSgpaValue = 10;

  if (!isOpen) {
    return (
      <div
        className="card"
        style={{
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          padding: "16px 20px",
          background: "var(--panel)",
          border: "1px solid var(--border)",
          transition: "all 0.2s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, flex: "1 1 300px" }}>
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
            <TrendingUp size={22} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              Semester-wise CGPA Trend Visualizer & Simulator
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              Track semester SGPA trajectory and simulate required future grades for your target CGPA.
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
          }}
        >
          <Sliders size={16} />
          Open CGPA Visualizer
          <ChevronDown size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: 20, position: "relative", overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <TrendingUp size={20} color="var(--accent)" />
          <div>
            <div className="label" style={{ fontSize: 16, fontWeight: 600 }}>
              Semester-wise CGPA Trend Visualizer & Simulator
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              Visualize SGPA vs CGPA progress across semesters and forecast target grades.
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {(targetCGPA !== 8.5 || futureSemesters !== 2 || simulatedFutureSGPA !== 8.0) && (
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
            Close Visualizer
            <ChevronUp size={14} />
          </button>
        </div>
      </div>

      {/* Historical Trend Chart */}
      <div style={{ marginBottom: 20, background: "var(--bg-elevated)", padding: 16, borderRadius: 12, border: "1px solid var(--border)" }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <Award size={16} color="var(--accent)" />
          Semester Performance Breakdown ({historyTrend.length} semester{historyTrend.length !== 1 ? "s" : ""})
        </div>

        {historyTrend.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "12px 0" }}>
            No semester grade cards uploaded yet. Upload a grade card above to see your trend chart!
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {historyTrend.map((h, i) => {
              const sgpaPct = (h.sgpa / maxSgpaValue) * 100;
              const cgpaPct = (h.runningCGPA / maxSgpaValue) * 100;
              const sgpaColor = h.sgpa >= 8.5 ? "#4fa88a" : h.sgpa >= 7 ? "#4c7eff" : h.sgpa >= 5.5 ? "#f59e0b" : "#c1554a";

              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 500 }}>
                    <span>{h.semester} <span style={{ color: "var(--text-muted)", fontSize: 11 }}>({h.credits} credits)</span></span>
                    <span style={{ fontFamily: "var(--font-mono)" }}>
                      SGPA: <strong style={{ color: sgpaColor }}>{h.sgpa}</strong> · Cumulative CGPA: <strong>{h.runningCGPA}</strong>
                    </span>
                  </div>
                  <div style={{ display: "flex", height: 10, background: "var(--border)", borderRadius: 6, overflow: "hidden", position: "relative" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${sgpaPct}%`,
                        background: sgpaColor,
                        borderRadius: 6,
                        transition: "width 0.6s ease",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Target CGPA Preset Selector */}
      <div style={{ marginBottom: 20, background: "var(--bg-elevated)", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
            <Sparkles size={16} color="var(--accent)" />
            Target CGPA Goal:
          </span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {TARGET_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setTargetCGPA(preset)}
                style={{
                  fontSize: 12,
                  fontWeight: targetCGPA === preset ? 600 : 400,
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: `1px solid ${targetCGPA === preset ? "var(--accent)" : "var(--border)"}`,
                  background: targetCGPA === preset ? "var(--accent)" : "transparent",
                  color: targetCGPA === preset ? "var(--accent-text)" : "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                {preset.toFixed(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Simulation Controls & Output Grid */}
      <div className="grid grid-2" style={{ gap: 20, alignItems: "start" }}>
        {/* Simulation Controls Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Upcoming Semesters Slider */}
          <div style={{ background: "var(--bg-elevated)", padding: 16, borderRadius: 12, border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                <BookOpen size={16} color="var(--accent)" />
                Upcoming Semesters to Forecast:
              </span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--accent)" }}>{futureSemesters} semester{futureSemesters !== 1 ? "s" : ""}</span>
            </div>
            <input
              type="range"
              min="1"
              max="6"
              value={futureSemesters}
              onChange={(e) => setFutureSemesters(Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--accent)", cursor: "pointer" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              <span>1 sem</span>
              <span>3 sems</span>
              <span>6 sems</span>
            </div>
          </div>

          {/* Test Future SGPA Slider */}
          <div style={{ background: "var(--bg-elevated)", padding: 16, borderRadius: 12, border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                <Sliders size={16} color="var(--present)" />
                Hypothetical Future SGPA:
              </span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--present)" }}>{simulatedFutureSGPA.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="5.0"
              max="10.0"
              step="0.1"
              value={simulatedFutureSGPA}
              onChange={(e) => setSimulatedFutureSGPA(Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--present)", cursor: "pointer" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              <span>5.0</span>
              <span>7.5</span>
              <span>10.0</span>
            </div>
          </div>
        </div>

        {/* Forecast Output Column */}
        <div style={{ background: "var(--bg-elevated)", padding: 20, borderRadius: 16, border: `1px solid ${projectedCGPA >= targetCGPA ? "var(--present)" : "var(--accent)"}`, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flexGrow: 1 }}>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-muted)" }}>Projected Final CGPA</div>
              <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-mono)", color: projectedCGPA >= targetCGPA ? "var(--present)" : "var(--text)" }}>
                {projectedCGPA > 0 ? projectedCGPA.toFixed(2) : "—"}
                {cgpaDelta !== 0 && (
                  <span style={{ fontSize: 13, fontWeight: 500, marginLeft: 8, color: cgpaDelta >= 0 ? "var(--present)" : "var(--absent)" }}>
                    ({cgpaDelta >= 0 ? `+${cgpaDelta.toFixed(2)}` : cgpaDelta.toFixed(2)})
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                Over {totalSimulatedCredits} total credits ({futureSemesters} future semester{futureSemesters !== 1 ? "s" : ""})
              </div>
            </div>
          </div>

          {/* Forecast Insights Badges */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {semesters.length === 0 ? (
              <div style={{ padding: "8px 12px", background: "var(--accent-soft)", border: "1px solid var(--accent)", borderRadius: 8, fontSize: 13, color: "var(--text)", display: "flex", gap: 8, alignItems: "center" }}>
                <Sparkles size={18} color="var(--accent)" style={{ flexShrink: 0 }} />
                <div>
                  <strong>Get Started:</strong> Upload your semester grade card above to calculate exact target requirements!
                </div>
              </div>
            ) : isAlreadyAchieved ? (
              <div style={{ padding: "8px 12px", background: "rgba(79, 168, 138, 0.12)", border: "1px solid var(--present)", borderRadius: 8, fontSize: 13, color: "var(--text)", display: "flex", gap: 8, alignItems: "start" }}>
                <CheckCircle2 size={18} color="var(--present)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong>Goal Achieved:</strong> Your current CGPA (<strong>{currentCGPA.toFixed(2)}</strong>) already meets your target goal of <strong>{targetCGPA.toFixed(1)}</strong>!
                </div>
              </div>
            ) : isAchievable ? (
              <div style={{ padding: "8px 12px", background: "rgba(76, 126, 255, 0.12)", border: "1px solid var(--accent)", borderRadius: 8, fontSize: 13, color: "var(--text)", display: "flex", gap: 8, alignItems: "start" }}>
                <CheckCircle2 size={18} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong>Target Required SGPA:</strong> Maintain an average SGPA of <strong>{requiredSGPA > 0 ? requiredSGPA.toFixed(2) : "0.00"}</strong> over the next {futureSemesters} semester(s) to reach <strong>{targetCGPA.toFixed(1)}</strong> CGPA.
                </div>
              </div>
            ) : (
              <div style={{ padding: "8px 12px", background: "rgba(193, 85, 74, 0.12)", border: "1px solid var(--absent)", borderRadius: 8, fontSize: 13, color: "var(--text)", display: "flex", gap: 8, alignItems: "start" }}>
                <AlertTriangle size={18} color="var(--absent)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong>Target Challenge:</strong> Reaching <strong>{targetCGPA.toFixed(1)}</strong> CGPA would require an average SGPA of <strong>{requiredSGPA.toFixed(2)}</strong> (&gt; 10.00 max). Consider increasing future semesters or adjusting your target goal.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
