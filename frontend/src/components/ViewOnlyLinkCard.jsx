import React, { useState } from "react";
import { Link2, Eye, Copy, Check, RefreshCw, ExternalLink, ShieldCheck, Share2 } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useConfirm, CONFIRM_REGENERATE_VIEW_LINK } from "../context/ConfirmContext.jsx";
import { api } from "../api/client.js";

export default function ViewOnlyLinkCard({ compact = false }) {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!user?.viewToken) return null;

  const link = `${window.location.origin}/view/${user.viewToken}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // fallback manual copy
    }
  }

  async function handleRegenerate() {
    if (!(await confirm(CONFIRM_REGENERATE_VIEW_LINK))) return;
    setLoading(true);
    try {
      const data = await api.post("/auth/view-token/regenerate", {});
      setUser(data.user);
      toast.success("New view-only link generated. The old one no longer works.");
    } catch (err) {
      // Silence here was actively misleading: the user has just been told the
      // old link will stop working, so they need to know it didn't happen.
      toast.error(`Couldn't regenerate the link — ${err.message}. Your old link still works.`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="card"
      style={{
        position: "relative",
        overflow: "hidden",
        border: "1px solid var(--border)",
        background: "var(--panel)",
        boxShadow: "var(--shadow)",
        transition: "all 0.2s ease",
      }}
    >
      {/* Decorative Gradient Accent Stripe */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: "linear-gradient(90deg, var(--accent), var(--present))",
        }}
      />

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "var(--accent-soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent)",
              flexShrink: 0,
            }}
          >
            <Share2 size={20} />
          </div>
          <div>
            <h3
              style={{
                fontSize: 16,
                fontWeight: 600,
                margin: 0,
                fontFamily: "var(--font-display)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              Shared View-Only Link
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "3px 0 0 0" }}>
              Share read-only access to your live attendance, tasks, grades, and timetable.
            </p>
          </div>
        </div>
      </div>

      {/* Security Feature Badges */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            padding: "3px 10px",
            borderRadius: 999,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <Eye size={12} color="var(--accent)" />
          Read-Only Mode
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            padding: "3px 10px",
            borderRadius: 999,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <ShieldCheck size={12} color="var(--present)" />
          No Password Required
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            padding: "3px 10px",
            borderRadius: 999,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <RefreshCw size={12} color="var(--urgent)" />
          Revocable Anytime
        </span>
      </div>

      {/* Input Action Group */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 260px", minWidth: 0 }}>
          <input
            className="input"
            readOnly
            value={link}
            onClick={(e) => e.target.select()}
            style={{
              width: "100%",
              paddingLeft: 36,
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
          />
          <Link2
            size={16}
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
              pointerEvents: "none",
            }}
          />
        </div>

        <button
          type="button"
          className="btn"
          onClick={handleCopy}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            minWidth: 100,
            justifyContent: "center",
            background: copied ? "var(--present)" : "var(--accent)",
            color: "var(--accent-text)",
            transition: "all 0.2s ease",
          }}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? "Copied!" : "Copy Link"}
        </button>

        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            textDecoration: "none",
            fontSize: 13,
            padding: "8px 12px",
          }}
          title="Open view-only link in new tab to test"
        >
          <ExternalLink size={16} />
          Preview
        </a>

        <button
          type="button"
          className="btn btn-ghost"
          onClick={handleRegenerate}
          disabled={loading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            padding: "8px 12px",
            color: "var(--text-muted)",
          }}
          title="Invalidate old link and issue a fresh view-only URL"
        >
          <RefreshCw size={14} className={loading ? "spin" : ""} />
          {loading ? "Regenerating..." : "Regenerate"}
        </button>
      </div>
    </div>
  );
}
