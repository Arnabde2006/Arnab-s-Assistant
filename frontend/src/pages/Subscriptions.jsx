import React, { useEffect, useState } from "react";
import { api } from "../api/client.js";
import {
  CreditCard,
  Upload,
  Plus,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Edit2,
  Trash2,
  ExternalLink,
  Sparkles,
  Calendar
} from "lucide-react";

function pad(n) {
  return String(n).padStart(2, "0");
}

function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function Subscriptions() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // 'all' | 'trials' | 'active' | 'cancelled'
  
  // OCR & Form state
  const [uploading, setUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingSub, setEditingSub] = useState(null);
  
  // Modal Form State
  const [formData, setFormData] = useState({
    name: "",
    plan_type: "free_trial",
    amount: "99",
    currency: "₹",
    billing_cycle: "monthly",
    start_date: toISO(new Date()),
    renewal_date: "",
    remind_days_before: 3,
    status: "active",
    notes: "",
  });
  
  const [formError, setFormError] = useState("");

  async function loadSubscriptions() {
    try {
      setLoading(true);
      const data = await api.get("/subscriptions");
      setSubscriptions(data.subscriptions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const openAddModal = () => {
    setEditingSub(null);
    const defaultRenewal = new Date();
    defaultRenewal.setDate(defaultRenewal.getDate() + 30);
    setFormData({
      name: "",
      plan_type: "free_trial",
      amount: "99",
      currency: "₹",
      billing_cycle: "monthly",
      start_date: toISO(new Date()),
      renewal_date: toISO(defaultRenewal),
      remind_days_before: 3,
      status: "active",
      notes: "",
    });
    setFormError("");
    setShowModal(true);
  };

  const openEditModal = (sub) => {
    setEditingSub(sub);
    setFormData({
      name: sub.name || "",
      plan_type: sub.plan_type || "free_trial",
      amount: sub.amount ? String(sub.amount) : "0",
      currency: sub.currency || "₹",
      billing_cycle: sub.billing_cycle || "monthly",
      start_date: sub.start_date ? sub.start_date.split("T")[0] : toISO(new Date()),
      renewal_date: sub.renewal_date ? sub.renewal_date.split("T")[0] : "",
      remind_days_before: sub.remind_days_before || 3,
      status: sub.status || "active",
      notes: sub.notes || "",
    });
    setFormError("");
    setShowModal(true);
  };

  const handleScreenshotUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload a valid image file (PNG, JPG, WEBP).");
      return;
    }

    try {
      setUploading(true);
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result.split(",")[1];
        try {
          const res = await api.post("/subscriptions/parse-screenshot", {
            fileBase64: base64Data,
            mimeType: file.type,
          });

          if (res.extracted) {
            const ext = res.extracted;
            setEditingSub(null);
            setFormData({
              name: ext.name || "Subscription",
              plan_type: ext.plan_type || "free_trial",
              amount: ext.amount !== undefined ? String(ext.amount) : "99",
              currency: ext.currency || "₹",
              billing_cycle: ext.billing_cycle || "monthly",
              start_date: toISO(new Date()),
              renewal_date: ext.renewal_date || toISO(new Date(Date.now() + 31 * 86400000)),
              remind_days_before: ext.remind_days_before || 3,
              status: "active",
              notes: ext.notes || "Extracted from screenshot via AI",
            });
            setFormError("");
            setShowModal(true);
          }
        } catch (err) {
          alert(err.message || "Failed to analyze image. Please try again or fill manually.");
        } finally {
          setUploading(false);
          e.target.value = "";
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setUploading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError("Service name is required.");
      return;
    }
    if (!formData.renewal_date) {
      setFormError("Renewal / charge date is required.");
      return;
    }

    try {
      if (editingSub) {
        await api.put(`/subscriptions/${editingSub.id}`, formData);
      } else {
        await api.post("/subscriptions", formData);
      }
      setShowModal(false);
      loadSubscriptions();
    } catch (err) {
      setFormError(err.message || "Failed to save subscription");
    }
  };

  const toggleStatus = async (sub, newStatus) => {
    try {
      await api.put(`/subscriptions/${sub.id}`, { status: newStatus });
      loadSubscriptions();
    } catch (err) {
      alert(err.message || "Failed to update status");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this subscription?")) return;
    try {
      await api.del(`/subscriptions/${id}`);
      loadSubscriptions();
    } catch (err) {
      alert(err.message || "Failed to delete subscription");
    }
  };

  // Metrics
  const activeSubs = subscriptions.filter((s) => s.status === "active");
  const freeTrials = activeSubs.filter((s) => s.plan_type === "free_trial");
  const urgentTrials = freeTrials.filter((s) => Number(s.days_remaining) <= 7);
  const totalMonthlyCost = activeSubs.reduce((sum, s) => {
    const val = Number(s.amount) || 0;
    if (s.billing_cycle === "yearly") return sum + val / 12;
    return sum + val;
  }, 0);

  // Filtered List
  const filteredSubs = subscriptions.filter((s) => {
    if (filter === "trials") return s.plan_type === "free_trial" && s.status === "active";
    if (filter === "active") return s.status === "active";
    if (filter === "cancelled") return s.status === "cancelled";
    return true;
  });

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", paddingBottom: 40 }}>
      {/* Header */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <CreditCard className="icon" size={28} /> Subscriptions &amp; Free Trials
          </h1>
          <p className="page-subtitle">
            Track active trials, auto-renewals, and charge alerts so you can cancel before being charged.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {/* Upload Screenshot OCR Button */}
          <label className="btn-ghost btn" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Upload size={16} />
            {uploading ? "AI Reading Image..." : "Upload Screenshot"}
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleScreenshotUpload}
              disabled={uploading}
            />
          </label>

          <button className="btn" onClick={openAddModal} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Plus size={16} /> Add Subscription
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="label">Active Free Trials</div>
          <div className="stat-num" style={{ color: freeTrials.length > 0 ? "var(--urgent)" : "var(--text)" }}>
            {freeTrials.length}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            {urgentTrials.length > 0 ? `⚠️ ${urgentTrials.length} trial(s) ending within 7 days!` : "All trials on schedule"}
          </div>
        </div>

        <div className="card">
          <div className="label">Est. Monthly Subscription Expense</div>
          <div className="stat-num">
            ₹{totalMonthlyCost.toFixed(2)}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            From {activeSubs.length} active service(s)
          </div>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--accent)", fontWeight: 600, fontSize: 14 }}>
            <Sparkles size={16} /> AI Screenshot Reader Ready
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            Snap a screenshot of Crunchyroll or any app trial &amp; upload to auto-detect charge dates!
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { key: "all", label: `All (${subscriptions.length})` },
          { key: "trials", label: `Free Trials (${freeTrials.length})` },
          { key: "active", label: `Active (${activeSubs.length})` },
          { key: "cancelled", label: `Cancelled (${subscriptions.filter((s) => s.status === "cancelled").length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`btn ${filter === tab.key ? "" : "btn-ghost"}`}
            style={{ fontSize: 13, padding: "6px 16px" }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
          {[1, 2, 3].map((n) => (
            <div key={n} className="card skeleton-pulse" style={{ height: 140, borderRadius: 12 }} />
          ))}
        </div>
      )}

      {/* Subscription Cards List */}
      {!loading && filteredSubs.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
          <CreditCard size={40} style={{ color: "var(--text-muted)", marginBottom: 12 }} />
          <h3 style={{ margin: "0 0 6px 0", fontSize: 16 }}>No subscriptions found</h3>
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
            Upload a screenshot or click "Add Subscription" to start tracking your free trials &amp; auto-renewals.
          </p>
        </div>
      )}

      {!loading && filteredSubs.length > 0 && (
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))" }}>
          {filteredSubs.map((sub) => {
            const daysLeft = Number(sub.days_remaining);
            const isTrial = sub.plan_type === "free_trial";
            const isCancelled = sub.status === "cancelled";
            const isUrgent = !isCancelled && daysLeft >= 0 && daysLeft <= 5;

            return (
              <div
                key={sub.id}
                className="card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  border: isUrgent ? "1px solid var(--warning)" : isCancelled ? "1px solid var(--border-color)" : undefined,
                  opacity: isCancelled ? 0.75 : 1,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Top Badge Banner */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div>
                      <h3 style={{ margin: "0 0 4px 0", fontSize: 17, fontWeight: 700 }}>{sub.name}</h3>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: 12,
                            background: isCancelled
                              ? "var(--bg-secondary)"
                              : isTrial
                              ? "rgba(234, 179, 8, 0.15)"
                              : "rgba(59, 130, 246, 0.15)",
                            color: isCancelled
                              ? "var(--text-muted)"
                              : isTrial
                              ? "var(--warning)"
                              : "#3b82f6",
                          }}
                        >
                          {isCancelled ? "Cancelled" : isTrial ? "Free Trial" : "Paid Plan"}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                          {sub.currency}{sub.amount} / {sub.billing_cycle}
                        </span>
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      {!isCancelled && (
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: isUrgent ? "var(--warning)" : daysLeft < 0 ? "var(--text-muted)" : "var(--primary-color)",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            justifyContent: "flex-end",
                          }}
                        >
                          {isUrgent && <AlertTriangle size={14} />}
                          {daysLeft < 0
                            ? "Passed"
                            : daysLeft === 0
                            ? "Charges Today!"
                            : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notes / Details */}
                  <div style={{ marginTop: 12, fontSize: 13, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Calendar size={14} />
                      <span>
                        {isTrial ? "Trial ends / Charges on:" : "Next Renewal Date:"}{" "}
                        <strong style={{ color: "var(--text)" }}>{formatDateDisplay(sub.renewal_date.split("T")[0])}</strong>
                      </span>
                    </div>

                    {sub.notes && (
                      <div style={{ fontStyle: "italic", background: "var(--bg-secondary)", padding: "6px 10px", borderRadius: 6, fontSize: 12 }}>
                        "{sub.notes}"
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    {isCancelled ? (
                      <button
                        className="btn btn-ghost"
                        onClick={() => toggleStatus(sub, "active")}
                        style={{ fontSize: 12, padding: "4px 8px", color: "var(--primary-color)" }}
                      >
                        Re-activate
                      </button>
                    ) : (
                      <button
                        className="btn btn-ghost"
                        onClick={() => toggleStatus(sub, "cancelled")}
                        style={{ fontSize: 12, padding: "4px 8px", color: "var(--warning)" }}
                        title="Mark as cancelled on provider website"
                      >
                        Mark Cancelled
                      </button>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => openEditModal(sub)}
                      style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 6 }}
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(sub.id)}
                      style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 6 }}
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Subscription Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 500,
              maxHeight: "90vh",
              overflowY: "auto",
              position: "relative",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                {editingSub ? "Edit Subscription" : "Add Subscription"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: "none", border: "none", fontSize: 20, color: "var(--text-muted)", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {formError && (
              <div style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  Service / App Name *
                </label>
                <input
                  className="input"
                  placeholder="e.g. Crunchyroll, Netflix, Spotify"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                    Plan Type
                  </label>
                  <select
                    className="input"
                    value={formData.plan_type}
                    onChange={(e) => setFormData({ ...formData, plan_type: e.target.value })}
                  >
                    <option value="free_trial">Free Trial</option>
                    <option value="paid">Paid Subscription</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                    Billing Cycle
                  </label>
                  <select
                    className="input"
                    value={formData.billing_cycle}
                    onChange={(e) => setFormData({ ...formData, billing_cycle: e.target.value })}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                    <option value="one_time">One Time</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                    Currency
                  </label>
                  <select
                    className="input"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  >
                    <option value="₹">₹ (INR)</option>
                    <option value="$">$ (USD)</option>
                    <option value="€">€ (EUR)</option>
                    <option value="£">£ (GBP)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                    Recurring Amount ({formData.currency})
                  </label>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    placeholder="99.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  Charge / Renewal Date *
                </label>
                <input
                  className="input"
                  type="date"
                  value={formData.renewal_date}
                  onChange={(e) => setFormData({ ...formData, renewal_date: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  Remind Me on Calendar (Days Before Charge)
                </label>
                <select
                  className="input"
                  value={formData.remind_days_before}
                  onChange={(e) => setFormData({ ...formData, remind_days_before: Number(e.target.value) })}
                >
                  <option value={1}>1 day before</option>
                  <option value={3}>3 days before</option>
                  <option value={5}>5 days before</option>
                  <option value={7}>7 days before</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  Notes / Details
                </label>
                <input
                  className="input"
                  placeholder="e.g. Free trial 31 days left. Cancel before August 26!"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button type="button" className="btn-ghost btn" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn">
                  Save Subscription
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
