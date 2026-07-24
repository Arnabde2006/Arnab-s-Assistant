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

// ── SVG Trend Chart Component ─────────────────────────────────────────────
function CGPATrendChart({
  historyTrend,
  futureSemesters,
  simulatedFutureSGPA,
  currentPoints,
  currentCredits,
  targetCGPA,
}) {
  const futureCreditsPerSem = 20;

  // Build full sequence of data points (Historical + Projected Future)
  const allPoints = [];

  // Historical points
  historyTrend.forEach((h, idx) => {
    allPoints.push({
      label: h.semester,
      shortLabel: `Sem ${idx + 1}`,
      sgpa: h.sgpa,
      cgpa: h.runningCGPA,
      isFuture: false,
    });
  });

  // Projected future points
  let lastPoints = currentPoints;
  let lastCredits = currentCredits;
  const histCount = historyTrend.length;

  for (let j = 1; j <= futureSemesters; j++) {
    lastCredits += futureCreditsPerSem;
    lastPoints += simulatedFutureSGPA * futureCreditsPerSem;
    const stepCGPA = lastCredits > 0 ? Math.round((lastPoints / lastCredits) * 100) / 100 : 0;

    allPoints.push({
      label: `Sem ${histCount + j} (Proj)`,
      shortLabel: `Sem ${histCount + j}*`,
      sgpa: simulatedFutureSGPA,
      cgpa: stepCGPA,
      isFuture: true,
    });
  }

  if (allPoints.length === 0) {
    return (
      <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "20px 0", textAlign: "center" }}>
        No semester data available to plot chart.
      </div>
    );
  }

  const svgWidth = 640;
  const svgHeight = 220;
  const paddingLeft = 45;
  const paddingRight = 45;
  const paddingTop = 32;
  const paddingBottom = 40;

  const chartW = svgWidth - paddingLeft - paddingRight;
  const chartH = svgHeight - paddingTop - paddingBottom;

  const minY = 5.0;
  const maxY = 10.0;

  const getY = (val) => {
    const clamped = Math.min(10.0, Math.max(5.0, val));
    return paddingTop + (1 - (clamped - minY) / (maxY - minY)) * chartH;
  };

  const getX = (idx) => {
    if (allPoints.length <= 1) return paddingLeft + chartW / 2;
    return paddingLeft + (idx / (allPoints.length - 1)) * chartW;
  };

  // Find index split between historical and future
  const histCutoffIdx = historyTrend.length > 0 ? historyTrend.length - 1 : 0;

  // Build SVG Path strings
  const buildPath = (key, startIdx, endIdx) => {
    let d = "";
    for (let i = startIdx; i <= endIdx; i++) {
      const p = allPoints[i];
      const x = getX(i);
      const y = getY(p[key]);
      d += i === startIdx ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    return d;
  };

  // Paths
  const histCGPAPath = historyTrend.length > 0 ? buildPath("cgpa", 0, histCutoffIdx) : "";
  const projCGPAPath = allPoints.length > histCutoffIdx + 1 ? buildPath("cgpa", histCutoffIdx, allPoints.length - 1) : "";

  const histSGPAPath = historyTrend.length > 0 ? buildPath("sgpa", 0, histCutoffIdx) : "";
  const projSGPAPath = allPoints.length > histCutoffIdx + 1 ? buildPath("sgpa", histCutoffIdx, allPoints.length - 1) : "";

  // Gradient area path for CGPA
  let areaPath = "";
  if (allPoints.length > 0) {
    const firstX = getX(0);
    const lastX = getX(allPoints.length - 1);
    const bottomY = getY(minY);
    areaPath = `M ${firstX} ${bottomY}`;
    allPoints.forEach((p, idx) => {
      areaPath += ` L ${getX(idx)} ${getY(p.cgpa)}`;
    });
    areaPath += ` L ${lastX} ${bottomY} Z`;
  }

  const targetY = getY(targetCGPA);

  return (
    <div style={{ width: "100%", overflowX: "auto", position: "relative" }}>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ width: "100%", height: "auto", minWidth: 500, overflow: "visible" }}
      >
        <defs>
          <linearGradient id="cgpaAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--present)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--present)" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Y Grid lines & Y labels */}
        {[10.0, 9.0, 8.0, 7.0, 6.0, 5.0].map((val) => {
          const y = getY(val);
          return (
            <g key={val}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={svgWidth - paddingRight}
                y2={y}
                stroke="var(--border)"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <text
                x={paddingLeft - 8}
                y={y + 4}
                textAnchor="end"
                fill="var(--text-muted)"
                style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
              >
                {val.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Target CGPA Reference Line */}
        <line
          x1={paddingLeft}
          y1={targetY}
          x2={svgWidth - paddingRight}
          y2={targetY}
          stroke="var(--accent)"
          strokeDasharray="4 4"
          strokeWidth="1.5"
        />
        <text
          x={svgWidth - paddingRight + 4}
          y={targetY + 3}
          textAnchor="start"
          fill="var(--accent)"
          style={{ fontSize: 10, fontWeight: 600, fontFamily: "var(--font-mono)" }}
        >
          Target ({targetCGPA.toFixed(1)})
        </text>

        {/* Filled CGPA Gradient Area */}
        {areaPath && <path d={areaPath} fill="url(#cgpaAreaGrad)" />}

        {/* Historical SGPA Line (Thin Accent) */}
        {histSGPAPath && (
          <path
            d={histSGPAPath}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.5"
            strokeOpacity="0.6"
          />
        )}

        {/* Projected SGPA Line (Dashed Thin Accent) */}
        {projSGPAPath && (
          <path
            d={projSGPAPath}
            fill="none"
            stroke="var(--accent)"
            strokeDasharray="4 3"
            strokeWidth="1.5"
            strokeOpacity="0.8"
          />
        )}

        {/* Historical CGPA Line (Thick Present Color) */}
        {histCGPAPath && (
          <path
            d={histCGPAPath}
            fill="none"
            stroke="var(--present)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Projected CGPA Line (Thick Dashed) */}
        {projCGPAPath && (
          <path
            d={projCGPAPath}
            fill="none"
            stroke="var(--present)"
            strokeDasharray="6 4"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Nodes & Labels */}
        {allPoints.map((p, idx) => {
          const x = getX(idx);
          const yCGPA = getY(p.cgpa);
          const ySGPA = getY(p.sgpa);
          const isFut = p.isFuture;

          return (
            <g key={idx}>
              {/* X-axis label */}
              <text
                x={x}
                y={svgHeight - 12}
                textAnchor="middle"
                fill={isFut ? "var(--accent)" : "var(--text-muted)"}
                style={{ fontSize: 11, fontWeight: isFut ? 600 : 500 }}
              >
                {p.shortLabel}
              </text>

              {/* SGPA small dot */}
              <circle
                cx={x}
                cy={ySGPA}
                r="3"
                fill={isFut ? "var(--accent)" : "var(--accent)"}
                opacity="0.8"
              />

              {/* CGPA Node Outer Ring */}
              <circle
                cx={x}
                cy={yCGPA}
                r="6"
                fill="var(--panel)"
                stroke={isFut ? "var(--accent)" : "var(--present)"}
                strokeWidth="2.5"
              />

              {/* CGPA Node Value Badge */}
              <text
                x={x}
                y={yCGPA - 10}
                textAnchor="middle"
                fill={isFut ? "var(--accent)" : "var(--text)"}
                style={{ fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)" }}
              >
                {p.cgpa.toFixed(2)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Graph Legend */}
      <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 8, fontSize: 11, color: "var(--text-muted)", flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 16, height: 3, background: "var(--present)", borderRadius: 2 }} />
          Cumulative CGPA
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 16, height: 2, background: "var(--accent)", opacity: 0.7 }} />
          Semester SGPA
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 14, borderTop: "1.5px dashed var(--accent)" }} />
          Target Line ({targetCGPA.toFixed(1)})
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 14, borderTop: "2px dashed var(--present)" }} />
          Projected Future
        </span>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────
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
              Track semester SGPA trajectory graph and simulate required future grades for your target CGPA.
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

      {/* SVG Interactive Trend Graph */}
      <div style={{ marginBottom: 20, background: "var(--bg-elevated)", padding: 16, borderRadius: 12, border: "1px solid var(--border)" }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <Award size={16} color="var(--accent)" />
          CGPA & SGPA Trajectory Chart ({historyTrend.length} semester{historyTrend.length !== 1 ? "s" : ""} + {futureSemesters} forecasted)
        </div>

        <CGPATrendChart
          historyTrend={historyTrend}
          futureSemesters={futureSemesters}
          simulatedFutureSGPA={simulatedFutureSGPA}
          currentPoints={currentPoints}
          currentCredits={currentCredits}
          targetCGPA={targetCGPA}
        />
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
        <div
          style={{
            background: "var(--bg-elevated)",
            padding: 20,
            borderRadius: 16,
            border: `1px solid ${
              projectedCGPA >= targetCGPA
                ? "var(--present)"
                : isAchievable
                ? "var(--accent)"
                : "var(--absent)"
            }`,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flexGrow: 1 }}>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-muted)" }}>Projected Final CGPA</div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  fontFamily: "var(--font-mono)",
                  color: projectedCGPA >= targetCGPA ? "var(--present)" : projectedCGPA < currentCGPA ? "var(--absent)" : "var(--text)",
                }}
              >
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
            ) : projectedCGPA >= targetCGPA ? (
              <div style={{ padding: "8px 12px", background: "rgba(79, 168, 138, 0.12)", border: "1px solid var(--present)", borderRadius: 8, fontSize: 13, color: "var(--text)", display: "flex", gap: 8, alignItems: "start" }}>
                <CheckCircle2 size={18} color="var(--present)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong>Goal Achieved:</strong> With an average future SGPA of <strong>{simulatedFutureSGPA.toFixed(2)}</strong>, your projected CGPA will be <strong>{projectedCGPA.toFixed(2)}</strong> (meets your <strong>{targetCGPA.toFixed(1)}</strong> target)!
                </div>
              </div>
            ) : isAchievable ? (
              <div style={{ padding: "8px 12px", background: "rgba(76, 126, 255, 0.12)", border: "1px solid var(--accent)", borderRadius: 8, fontSize: 13, color: "var(--text)", display: "flex", gap: 8, alignItems: "start" }}>
                <CheckCircle2 size={18} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong>Target Required SGPA:</strong> With an SGPA of <strong>{simulatedFutureSGPA.toFixed(2)}</strong>, projected CGPA drops to <strong>{projectedCGPA.toFixed(2)}</strong>. You must maintain an average SGPA of <strong>{requiredSGPA > 0 ? requiredSGPA.toFixed(2) : "0.00"}</strong> over the next {futureSemesters} semester(s) to reach <strong>{targetCGPA.toFixed(1)}</strong> CGPA.
                </div>
              </div>
            ) : (
              <div style={{ padding: "8px 12px", background: "rgba(193, 85, 74, 0.12)", border: "1px solid var(--absent)", borderRadius: 8, fontSize: 13, color: "var(--text)", display: "flex", gap: 8, alignItems: "start" }}>
                <AlertTriangle size={18} color="var(--absent)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong>Target Challenge:</strong> Reaching <strong>{targetCGPA.toFixed(1)}</strong> CGPA would require an average SGPA of <strong>{requiredSGPA.toFixed(2)}</strong> (&gt; 10.00 max). Consider forecasting more semesters or adjusting your target goal.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
