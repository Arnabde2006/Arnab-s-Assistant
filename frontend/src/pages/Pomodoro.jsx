import React, { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Settings,
  Plus,
  Minus,
  SkipForward,
  ChevronRight
} from "lucide-react";

const MODE_DEFAULTS = {
  focus: { label: "Focus", minutes: 25, color: "var(--accent)" },
  short: { label: "Short Break", minutes: 5, color: "var(--present)" },
  long: { label: "Long Break", minutes: 15, color: "#7A8FC1" },
};

const AMBIENT_OPTIONS = [
  { value: "none", label: "No Sound", icon: "🔇" },
  { value: "rain", label: "Rain Noise", icon: "🌧️" },
  { value: "ocean", label: "Deep Brown", icon: "🌊" },
  { value: "pulse", label: "Sine Pulse", icon: "💓" },
];


export default function Pomodoro() {
  const [mode, setMode] = useState("focus");
  const [customDurations, setCustomDurations] = useState(() => {
    const saved = localStorage.getItem("pomo-durations");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return { focus: 25, short: 5, long: 15 };
  });

  const [secondsLeft, setSecondsLeft] = useState(customDurations.focus * 60);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(() => {
    const saved = localStorage.getItem("pomo-sessions");
    return saved ? Number(saved) : 0;
  });
  const [sessionGoal, setSessionGoal] = useState(() => {
    const saved = localStorage.getItem("pomo-goal");
    return saved ? Number(saved) : 4;
  });

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Ambient sound state
  const [ambientType, setAmbientType] = useState("none");
  const [volume, setVolume] = useState(0.2);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const intervalRef = useRef(null);
  const audioCtxRef = useRef(null);
  const currentNoiseSourceRef = useRef(null);
  const currentNoiseGainRef = useRef(null);
  const dropdownRef = useRef(null);

  // Click outside dropdown to close it
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Initialize and persist durations
  useEffect(() => {
    localStorage.setItem("pomo-durations", JSON.stringify(customDurations));
  }, [customDurations]);

  useEffect(() => {
    localStorage.setItem("pomo-sessions", String(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem("pomo-goal", String(sessionGoal));
  }, [sessionGoal]);

  // Sync timer when mode or customized settings change
  useEffect(() => {
    setSecondsLeft(customDurations[mode] * 60);
    setRunning(false);
  }, [mode, customDurations]);

  // Countdown timer loop
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            playChime();
            if (mode === "focus") {
              setSessions((n) => n + 1);
            }
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, mode]);

  // Update browser tab title
  useEffect(() => {
    const minStr = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
    const secStr = String(secondsLeft % 60).padStart(2, "0");
    const modeLabel = MODE_DEFAULTS[mode].label;
    
    if (running) {
      document.title = `(${minStr}:${secStr}) ${modeLabel} - Focus`;
    } else {
      document.title = "Focus Timer - Assistant";
    }
  }, [secondsLeft, running, mode]);

  // Restore page title on unmount & clean audio
  useEffect(() => {
    return () => {
      document.title = "Arnab's Assistant.";
      stopAmbient();
    };
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        setRunning((r) => !r);
      } else if (e.code === "Escape") {
        e.preventDefault();
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          setRunning(false);
          setSecondsLeft(customDurations[mode] * 60);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, customDurations, mode]);

  // Synths: Play Chime Bell on Finish
  const playChime = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc2.frequency.setValueAtTime(783.99, ctx.currentTime); // G5

      osc1.type = "sine";
      osc2.type = "sine";

      gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3.0);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc1.start();
      osc2.start();

      osc1.stop(ctx.currentTime + 3.0);
      osc2.stop(ctx.currentTime + 3.0);
    } catch (e) {
      console.error("Audio completion chime failed:", e);
    }
  };

  // Synths: Ambient Noise Machines
  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const stopAmbient = () => {
    if (currentNoiseSourceRef.current) {
      try {
        currentNoiseSourceRef.current.stop();
      } catch (e) {}
      try {
        currentNoiseSourceRef.current.disconnect();
      } catch (e) {}
      currentNoiseSourceRef.current = null;
    }
    if (currentNoiseGainRef.current) {
      try {
        currentNoiseGainRef.current.disconnect();
      } catch (e) {}
      currentNoiseGainRef.current = null;
    }
  };

  const startAmbient = (type, vol) => {
    stopAmbient();
    if (type === "none") return;

    try {
      const ctx = getAudioContext();
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(vol, ctx.currentTime);
      gainNode.connect(ctx.destination);
      currentNoiseGainRef.current = gainNode;

      if (type === "pulse") {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(65.41, ctx.currentTime); // Low C2 focus pulse

        const pulseGain = ctx.createGain();
        pulseGain.gain.setValueAtTime(0.12, ctx.currentTime);

        const lfo = ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.setValueAtTime(0.15, ctx.currentTime); // ~6.6s breath cycle

        const lfoGain = ctx.createGain();
        lfoGain.gain.setValueAtTime(0.08, ctx.currentTime);

        lfo.connect(lfoGain);
        lfoGain.connect(pulseGain.gain);
        
        osc.connect(pulseGain);
        pulseGain.connect(gainNode);

        osc.start();
        lfo.start();

        currentNoiseSourceRef.current = {
          stop: () => {
            osc.stop();
            lfo.stop();
          },
          disconnect: () => {
            osc.disconnect();
            lfo.disconnect();
            pulseGain.disconnect();
            lfoGain.disconnect();
          }
        };
      } else {
        const bufferSize = 2 * ctx.sampleRate;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);

        if (type === "ocean") {
          let lastOut = 0.0;
          for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            output[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = output[i];
            output[i] *= 4.0; 
          }
        } else if (type === "rain") {
          let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
          for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
            b6 = white * 0.115926;

            const isDroplet = Math.random() < 0.0007 ? (Math.random() * 2 - 1) : 0;
            output[i] = (pink * 0.14) + (isDroplet * 0.12);
          }
        }

        const source = ctx.createBufferSource();
        source.buffer = noiseBuffer;
        source.loop = true;
        source.connect(gainNode);
        source.start();
        currentNoiseSourceRef.current = source;
      }
    } catch (e) {
      console.error("Failed to generate ambient noise:", e);
    }
  };

  const handleAmbientTypeChange = (type) => {
    setAmbientType(type);
    startAmbient(type, volume);
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (currentNoiseGainRef.current && audioCtxRef.current) {
      currentNoiseGainRef.current.gain.setValueAtTime(val, audioCtxRef.current.currentTime);
    }
  };

  const incrementTime = () => {
    setSecondsLeft((s) => s + 60);
  };

  const decrementTime = () => {
    setSecondsLeft((s) => Math.max(0, s - 60));
  };

  const skipTimer = () => {
    setRunning(false);
    setSecondsLeft(0);
    playChime();
    if (mode === "focus") {
      setSessions((s) => s + 1);
    }
  };

  // Circle animation calculations
  const totalSeconds = customDurations[mode] * 60;
  const progress = totalSeconds > 0 ? (totalSeconds - secondsLeft) / totalSeconds : 0;
  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const secs = String(secondsLeft % 60).padStart(2, "0");

  const radius = 88;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  const activeColor = MODE_DEFAULTS[mode].color;

  // Main UI render helper for Timer Clock
  const renderClock = (size = 220) => (
    <div style={{ position: "relative", width: size, height: size, margin: "0 auto" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {/* Track Ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth="8"
        />
        {/* Active Ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={activeColor}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="pomo-ring-glow"
          style={{ transition: "stroke-dashoffset 0.35s ease-out" }}
        />
      </svg>
      {/* Time Text display */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: size * 0.17,
            fontWeight: "700",
            color: "var(--text)",
            letterSpacing: "-0.04em",
          }}
        >
          {mins}:{secs}
        </span>
        <span
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            fontWeight: "600",
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            marginTop: 4,
          }}
        >
          {MODE_DEFAULTS[mode].label}
        </span>
      </div>
    </div>
  );

  // Main controls render helper
  const renderControls = () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 24 }}>
      <button
        className="btn-ghost btn"
        onClick={decrementTime}
        title="-1 minute"
        style={{ width: 40, height: 40, borderRadius: "50%", padding: 0 }}
      >
        <Minus size={18} />
      </button>

      <button
        className="btn"
        onClick={() => setRunning(!running)}
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          padding: 0,
          background: activeColor,
          borderColor: activeColor,
          color: "var(--accent-text)",
          boxShadow: `0 8px 24px rgba(0, 0, 0, 0.15)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {running ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" style={{ marginLeft: 4 }} />}
      </button>

      <button
        className="btn-ghost btn"
        onClick={incrementTime}
        title="+1 minute"
        style={{ width: 40, height: 40, borderRadius: "50%", padding: 0 }}
      >
        <Plus size={18} />
      </button>

      <button
        className="btn-ghost btn"
        onClick={() => {
          setRunning(false);
          setSecondsLeft(customDurations[mode] * 60);
        }}
        title="Reset Timer"
        style={{ width: 40, height: 40, borderRadius: "50%", padding: 0 }}
      >
        <RotateCcw size={18} />
      </button>

      {running && (
        <button
          className="btn-ghost btn"
          onClick={skipTimer}
          title="Skip session"
          style={{ width: 40, height: 40, borderRadius: "50%", padding: 0 }}
        >
          <SkipForward size={18} />
        </button>
      )}
    </div>
  );

  // Ambient sound controller rendering helper with custom dropdown
  const renderAmbientPanel = () => {
    const selectedOption = AMBIENT_OPTIONS.find(opt => opt.value === ambientType) || AMBIENT_OPTIONS[0];

    return (
      <div className="pomo-ambient-panel" style={{ position: "relative" }} ref={dropdownRef}>
        <button
          className="btn-ghost btn"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          type="button"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            padding: "4px 8px",
            borderRadius: 99,
            border: "none",
            background: "transparent",
            color: "var(--text)",
            minHeight: "auto",
            cursor: "pointer"
          }}
        >
          <span>{selectedOption.icon} {selectedOption.label}</span>
          <ChevronRight size={14} style={{ transform: dropdownOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s", color: "var(--text-muted)" }} />
        </button>

        {dropdownOpen && (
          <div
            style={{
              position: "absolute",
              bottom: "calc(100% + 8px)",
              left: 0,
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              boxShadow: "var(--shadow)",
              zIndex: 100,
              width: 170,
              padding: 4,
              display: "flex",
              flexDirection: "column",
              gap: 2,
              animation: "pomoFadeIn 0.15s ease-out",
            }}
          >
            {AMBIENT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  handleAmbientTypeChange(opt.value);
                  setDropdownOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "8px 12px",
                  border: "none",
                  background: opt.value === ambientType ? "var(--panel-hover)" : "transparent",
                  color: opt.value === ambientType ? "var(--accent)" : "var(--text)",
                  borderRadius: "8px",
                  fontSize: 12,
                  fontWeight: 600,
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                className="pomo-dropdown-item"
              >
                <span>{opt.icon}</span>
                <span style={{ flex: 1 }}>{opt.label}</span>
              </button>
            ))}
          </div>
        )}

        {ambientType !== "none" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
            <Volume2 size={14} style={{ color: "var(--text-muted)" }} />
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.01"
              className="pomo-volume-slider"
              value={volume}
              onChange={handleVolumeChange}
              title={`Ambient volume: ${Math.round(volume * 200)}%`}
            />
          </div>
        )}
      </div>
    );
  };

  // ==========================================
  // FULL SCREEN VIEW OVERLAY
  // ==========================================
  if (isFullscreen) {
    return (
      <div className="pomo-fullscreen-overlay">
        <div className="pomo-fullscreen-content">
          <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", marginBottom: 60 }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, color: "var(--text)" }}>
              Focus Mode<span style={{ color: activeColor }}>.</span>
            </span>
            <button
              className="btn-ghost btn"
              onClick={() => setIsFullscreen(false)}
              title="Exit Focus Mode (Esc)"
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 999 }}
            >
              <Minimize2 size={16} />
              Exit Focus
            </button>
          </div>

          <div style={{ margin: "20px 0" }}>
            {renderClock(280)}
          </div>

          {renderControls()}

          <div style={{ marginTop: 40 }}>
            {renderAmbientPanel()}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // STANDARD DESKTOP / GRID LAYOUT VIEW
  // ==========================================
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Focus timer</h1>
          <p className="page-subtitle">Elevate productivity with a premium offline sound machine and distraction-free workspace.</p>
        </div>
        <button
          className="btn-ghost btn"
          onClick={() => setIsFullscreen(true)}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <Maximize2 size={15} />
          Focus Mode
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24, alignItems: "start" }}>
        
        {/* Left Side: Clock Card */}
        <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 16px" }}>
          
          {/* Mode switching tabs */}
          <div className="pomo-tabs">
            {Object.keys(MODE_DEFAULTS).map((m) => (
              <button
                key={m}
                className={`pomo-tab-btn ${m === mode ? "active" : ""}`}
                onClick={() => setMode(m)}
              >
                {MODE_DEFAULTS[m].label}
              </button>
            ))}
          </div>

          {/* Core Clock */}
          {renderClock(220)}

          {/* Quick Buttons Control */}
          {renderControls()}

          {/* Sound Synthesizer Controls */}
          {renderAmbientPanel()}
        </div>

        {/* Right Side: Goals & Settings Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          
          {/* Daily Goal & Stats Card */}
          <div className="card">
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 6px 0", display: "flex", justifySelf: "flex-start" }}>Daily Goals</h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 16px 0" }}>
              Focus on 4 sessions to secure 2 hours of solid learning.
            </p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 32, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text)" }}>{sessions}</span>
              <span style={{ color: "var(--text-muted)", fontSize: 14 }}>/ {sessionGoal} completed today</span>
            </div>

            {/* Goal Progress bar */}
            <div style={{ width: "100%", height: 8, background: "var(--border-strong)", borderRadius: 999, overflow: "hidden", marginBottom: 20 }}>
              <div
                style={{
                  width: `${Math.min(100, (sessions / sessionGoal) * 100)}%`,
                  height: "100%",
                  background: activeColor,
                  borderRadius: 999,
                  transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                className="btn-ghost btn"
                style={{ fontSize: 12, padding: "6px 12px", minHeight: "auto" }}
                onClick={() => setSessions(0)}
              >
                Reset Progress
              </button>
              <button
                className="btn-ghost btn"
                style={{ fontSize: 12, padding: "6px 12px", minHeight: "auto", display: "flex", alignItems: "center", gap: 4 }}
                onClick={() => setSessionGoal((g) => Math.max(1, g + 1))}
              >
                Increase Goal (+1)
              </button>
              <button
                className="btn-ghost btn"
                style={{ fontSize: 12, padding: "6px 12px", minHeight: "auto", display: "flex", alignItems: "center", gap: 4 }}
                onClick={() => setSessionGoal((g) => Math.max(1, g - 1))}
              >
                Decrease Goal (-1)
              </button>
            </div>
          </div>

          {/* Quick durations Settings Card */}
          <div className="card">
            <button
              onClick={() => setShowSettings(!showSettings)}
              style={{
                background: "none",
                border: "none",
                width: "100%",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                color: "var(--text)",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 14
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Settings size={16} /> Customize Timer Durations
              </span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{showSettings ? "Hide" : "Edit"}</span>
            </button>

            {showSettings && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
                <div>
                  <label className="label" style={{ fontSize: 11, marginBottom: 4 }} htmlFor="set-focus">Focus Duration (mins)</label>
                  <input
                    id="set-focus"
                    type="number"
                    min="1"
                    className="input"
                    value={customDurations.focus}
                    onChange={(e) => setCustomDurations((d) => ({ ...d, focus: Math.max(1, Number(e.target.value)) }))}
                  />
                </div>
                <div>
                  <label className="label" style={{ fontSize: 11, marginBottom: 4 }} htmlFor="set-short">Short Break (mins)</label>
                  <input
                    id="set-short"
                    type="number"
                    min="1"
                    className="input"
                    value={customDurations.short}
                    onChange={(e) => setCustomDurations((d) => ({ ...d, short: Math.max(1, Number(e.target.value)) }))}
                  />
                </div>
                <div>
                  <label className="label" style={{ fontSize: 11, marginBottom: 4 }} htmlFor="set-long">Long Break (mins)</label>
                  <input
                    id="set-long"
                    type="number"
                    min="1"
                    className="input"
                    value={customDurations.long}
                    onChange={(e) => setCustomDurations((d) => ({ ...d, long: Math.max(1, Number(e.target.value)) }))}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
