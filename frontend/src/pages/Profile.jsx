import React, { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api/client.js";
import Switch from "../components/Switch.jsx";
import ViewOnlyLinkCard from "../components/ViewOnlyLinkCard.jsx";
import { Smartphone, Check } from "lucide-react";

export default function Profile() {
  const { user, setUser } = useAuth();

  // Profile fields state
  const [name, setName] = useState(user?.name || "");
  const [attendanceGoal, setAttendanceGoal] = useState(user?.attendanceGoal || 75);
  const [budgetEnabled, setBudgetEnabled] = useState(user?.monthlyBudget !== null && user?.monthlyBudget !== undefined);
  const [monthlyBudget, setMonthlyBudget] = useState(user?.monthlyBudget || "");

  // Mobile navigation preference state
  const [mobileNavStyle, setMobileNavStyle] = useState(() => localStorage.getItem("mobileNavStyle") || "bottom_bar");

  const updateMobileNavStyle = (style) => {
    setMobileNavStyle(style);
    localStorage.setItem("mobileNavStyle", style);
    window.dispatchEvent(new Event("mobileNavStyleChange"));
  };

  // Password fields state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Status states
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [copied, setCopied] = useState(false);
  const [regenerateLoading, setRegenerateLoading] = useState(false);

  // Profile update handler
  async function handleProfileSubmit(e) {
    e.preventDefault();
    setProfileSuccess("");
    setProfileError("");
    setProfileLoading(true);

    try {
      const goalValue = Number(attendanceGoal);
      if (isNaN(goalValue) || goalValue < 1 || goalValue > 100) {
        throw new Error("Attendance goal must be a percentage between 1 and 100");
      }

      const updateData = {
        name: name.trim(),
        attendanceGoal: goalValue,
      };

      if (user && 'monthlyBudget' in user) {
        const budgetValue = budgetEnabled ? Number(monthlyBudget) : null;
        if (budgetEnabled && (!monthlyBudget || isNaN(budgetValue) || budgetValue <= 0)) {
          throw new Error("Please enter a valid monthly budget greater than 0");
        }
        updateData.monthlyBudget = budgetValue;
      }

      const data = await api.put("/auth/me", updateData);

      setUser(data.user);
      localStorage.setItem("user", JSON.stringify(data.user));
      setProfileSuccess("Profile preferences updated successfully!");
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setProfileLoading(false);
    }
  }

  // Password change handler
  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPasswordSuccess("");
    setPasswordError("");

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters");
      return;
    }

    setPasswordLoading(true);

    try {
      await api.put("/auth/me", {
        currentPassword,
        newPassword,
      });

      setPasswordSuccess("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setPasswordLoading(false);
    }
  }

  // Copy View Token helper
  const viewOnlyLink = `${window.location.origin}/view/${user?.viewToken}`;
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(viewOnlyLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }

  // Invalidate and regenerate View Token helper
  async function handleRegenerate() {
    if (!confirm("This will invalidate your old view-only link. Anyone you shared it with will lose access. Continue?")) return;
    setRegenerateLoading(true);
    try {
      const data = await api.post("/auth/view-token/regenerate", {});
      setUser(data.user);
      localStorage.setItem("user", JSON.stringify(data.user));
      setProfileSuccess("New view-only link generated!");
    } catch (err) {
      setProfileError("Failed to regenerate link: " + err.message);
    } finally {
      setRegenerateLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Profile &amp; Settings</h1>
          <p className="page-subtitle">Manage your personal settings, security, and shared access.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24, alignItems: "start" }}>
        
        {/* Card 1: Details and Preferences */}
        <form onSubmit={handleProfileSubmit} className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 4px 0", fontFamily: "var(--font-display)" }}>Account Details</h2>
          
          <div>
            <label className="label" htmlFor="profile-name">Name</label>
            <input
              id="profile-name"
              className="input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Your Name"
            />
          </div>

          <div>
            <label className="label" htmlFor="profile-email">Email</label>
            <input
              id="profile-email"
              className="input"
              type="email"
              value={user?.email || ""}
              disabled
              style={{ opacity: 0.6, cursor: "not-allowed" }}
            />
            <span style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, display: "block" }}>Email address cannot be changed</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: user && 'monthlyBudget' in user ? "1fr 1fr" : "1fr", gap: 16 }}>
            <div>
              <label className="label" htmlFor="profile-attendance">Attendance Goal (%)</label>
              <input
                id="profile-attendance"
                className="input"
                type="number"
                min="1"
                max="100"
                value={attendanceGoal}
                onChange={(e) => setAttendanceGoal(e.target.value)}
                required
              />
            </div>

            {user && 'monthlyBudget' in user && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label className="label" htmlFor="profile-budget" style={{ marginBottom: 0 }}>Monthly Budget</label>
                  <Switch ariaLabel="Enable monthly budget" checked={budgetEnabled} onChange={(val) => {
                    setBudgetEnabled(val);
                    if (val && !monthlyBudget) setMonthlyBudget("");
                  }} />
                </div>
                <input
                  id="profile-budget"
                  className="input"
                  type="number"
                  min="1"
                  placeholder="e.g. 5000"
                  value={monthlyBudget}
                  disabled={!budgetEnabled}
                  onChange={(e) => setMonthlyBudget(e.target.value)}
                  style={{ opacity: budgetEnabled ? 1 : 0.5 }}
                />
              </div>
            )}
          </div>

          {profileError && <div className="error-text" style={{ fontSize: 13 }}>{profileError}</div>}
          {profileSuccess && <div style={{ fontSize: 13, color: "var(--present)" }}>{profileSuccess}</div>}

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <button className="btn" type="submit" disabled={profileLoading} style={{ minWidth: 120 }}>
              {profileLoading ? "Saving..." : "Save Preferences"}
            </button>
          </div>
        </form>

        {/* Card 2: Security & Password */}
        <form onSubmit={handlePasswordSubmit} className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 4px 0", fontFamily: "var(--font-display)" }}>Security</h2>

          <div>
            <label className="label" htmlFor="curr-password">Current Password</label>
            <input
              id="curr-password"
              className="input"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              required={!!newPassword}
            />
          </div>

          <div>
            <label className="label" htmlFor="new-password">New Password</label>
            <input
              id="new-password"
              className="input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 6 characters"
              required={!!currentPassword}
            />
          </div>

          <div>
            <label className="label" htmlFor="conf-password">Confirm New Password</label>
            <input
              id="conf-password"
              className="input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required={!!newPassword}
            />
          </div>

          {passwordError && <div className="error-text" style={{ fontSize: 13 }}>{passwordError}</div>}
          {passwordSuccess && <div style={{ fontSize: 13, color: "var(--present)" }}>{passwordSuccess}</div>}

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <button className="btn" type="submit" disabled={passwordLoading} style={{ minWidth: 120 }}>
              {passwordLoading ? "Updating..." : "Update Password"}
            </button>
          </div>
        </form>

        {/* Card 3: Mobile Navigation Preference (Only visible on mobile screens) */}
        <div className="card mobile-only-setting" style={{ flexDirection: "column", gap: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 4px 0", fontFamily: "var(--font-display)", display: "flex", alignItems: "center", gap: 8 }}>
            <Smartphone size={18} /> Mobile Navigation Style
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>
            Select how you want to navigate when using the app on a mobile phone or tablet screen.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
            {/* Option A: Slide-Out Drawer (3-Line Top-Left Hamburger) */}
            <div
              onClick={() => updateMobileNavStyle("hamburger_drawer")}
              style={{
                padding: "14px 16px",
                borderRadius: "var(--radius-sm)",
                background: mobileNavStyle === "hamburger_drawer" ? "var(--accent-soft)" : "var(--bg-elevated)",
                border: mobileNavStyle === "hamburger_drawer" ? "2px solid var(--accent)" : "1px solid var(--border)",
                cursor: "pointer",
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                transition: "all 0.2s ease"
              }}
            >
              <input
                type="radio"
                className="custom-checkbox"
                name="mobileNavStyle"
                checked={mobileNavStyle === "hamburger_drawer"}
                onChange={() => updateMobileNavStyle("hamburger_drawer")}
                style={{ marginTop: 2, borderRadius: "50%" }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>Slide-out Menu Drawer (3-Line Top-Left Icon)</span>
                  {mobileNavStyle === "hamburger_drawer" && <span style={{ fontSize: 11, background: "var(--accent)", color: "#fff", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>Active</span>}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.4 }}>
                  Hides bottom bar. Tapping the ≡ 3-line icon on top-left opens a full sliding page listing all menus with item titles &amp; light grey descriptions.
                </div>
              </div>
            </div>

            {/* Option B: Bottom Bar + Swipe Up Grid (Default) */}
            <div
              onClick={() => updateMobileNavStyle("bottom_bar")}
              style={{
                padding: "14px 16px",
                borderRadius: "var(--radius-sm)",
                background: mobileNavStyle === "bottom_bar" ? "var(--accent-soft)" : "var(--bg-elevated)",
                border: mobileNavStyle === "bottom_bar" ? "2px solid var(--accent)" : "1px solid var(--border)",
                cursor: "pointer",
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                transition: "all 0.2s ease"
              }}
            >
              <input
                type="radio"
                className="custom-checkbox"
                name="mobileNavStyle"
                checked={mobileNavStyle === "bottom_bar"}
                onChange={() => updateMobileNavStyle("bottom_bar")}
                style={{ marginTop: 2, borderRadius: "50%" }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>Bottom Navigation Bar + Swipe-Up Grid (Default)</span>
                  {mobileNavStyle === "bottom_bar" && <span style={{ fontSize: 11, background: "var(--accent)", color: "#fff", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>Active</span>}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.4 }}>
                  Horizontal scrollable bottom bar with swipe left/right &amp; swipe-up gesture to reveal all features in a 4-column grid.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <ViewOnlyLinkCard />
      </div>
    </div>
  );
}
