import React, { useEffect, useState, useRef } from "react";
import { api } from "../api/client.js";
import { useLoadAnnounce } from "../context/AnnouncerContext.jsx";
import { useDialog } from "../hooks/useDialog.js";
import { useToast } from "../context/ToastContext.jsx";
import { useConfirm } from "../context/ConfirmContext.jsx";
import ReorderControls from "../components/ReorderControls.jsx";
import { toISO, formatMediumDate as formatDateDisplay } from "../utils/format.js";
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
  Calendar,
  Camera,
  Loader2,
  GripVertical
} from "lucide-react";

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

  // Multi-subscription preview state
  const [extractedList, setExtractedList] = useState([]);
  const [showMultiModal, setShowMultiModal] = useState(false);
  const formDialog = useDialog(showModal, () => setShowModal(false));
  const importDialog = useDialog(showMultiModal, () => setShowMultiModal(false));
  const [savingMulti, setSavingMulti] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  useLoadAnnounce(
    loading,
    "Loading subscriptions",
    `${subscriptions.length} subscription${subscriptions.length === 1 ? "" : "s"} loaded`
  );

  // Filtered List — declared here because the reorder helpers below need it.
  const filteredSubs = subscriptions.filter((s) => {
    if (filter === "trials") return s.plan_type === "free_trial" && s.status === "active";
    if (filter === "active") return s.status === "active";
    if (filter === "cancelled") return s.status === "cancelled";
    return true;
  });

  // Reordering (drag, and now keyboard) ───────────────────────────────────────
  // Everything below keys off subscription ids rather than array indices. The
  // cards render `filteredSubs`, which is a subset of `subscriptions` whenever a
  // filter is active, but the order that gets persisted is the full array — so
  // the old code, which spliced `subscriptions` at an index into `filteredSubs`,
  // reordered the wrong subscriptions under any filter but "all".
  const [draggedSubId, setDraggedSubId] = useState(null);
  const [dragOverSubId, setDragOverSubId] = useState(null);
  const [reorderMessage, setReorderMessage] = useState("");

  const saveSubOrder = async (updatedSubs) => {
    const previous = subscriptions;
    setSubscriptions(updatedSubs);
    try {
      const subIds = updatedSubs.map((s) => s.id);
      await api.put("/subscriptions/reorder", { subIds });
    } catch (err) {
      // Undo the optimistic move and say so. Logging this to the console left
      // the list showing an order the server had rejected until a full reload.
      setSubscriptions(previous);
      toast.error("Couldn't save the new order");
    }
  };

  // Move `sourceId` into `targetId`'s slot. Whether it lands before or after the
  // target depends on which way it is travelling in the visible list, so a card
  // ends up where the user actually dropped it instead of one slot short.
  const reorderSubs = (sourceId, targetId) => {
    const visibleFrom = filteredSubs.findIndex((s) => s.id === sourceId);
    const visibleTo = filteredSubs.findIndex((s) => s.id === targetId);
    if (visibleFrom === -1 || visibleTo === -1 || visibleFrom === visibleTo) return null;

    const updated = [...subscriptions];
    const from = updated.findIndex((s) => s.id === sourceId);
    if (from === -1) return null;
    const [moved] = updated.splice(from, 1);
    const to = updated.findIndex((s) => s.id === targetId);
    if (to === -1) return null;
    updated.splice(visibleTo > visibleFrom ? to + 1 : to, 0, moved);

    saveSubOrder(updated);
    return { name: moved.name, position: visibleTo + 1, total: filteredSubs.length };
  };

  // Keyboard path: step over the neighbouring *visible* card. Stepping by raw
  // array index would hop a hidden subscription and appear to do nothing.
  const moveSub = (subId, delta) => {
    const visibleFrom = filteredSubs.findIndex((s) => s.id === subId);
    const visibleTo = visibleFrom + delta;
    if (visibleFrom === -1 || visibleTo < 0 || visibleTo >= filteredSubs.length) return;
    const moved = reorderSubs(subId, filteredSubs[visibleTo].id);
    if (moved) {
      setReorderMessage(`${moved.name} moved to position ${moved.position} of ${moved.total}`);
    }
  };

  const handleSubDragStart = (e, subId) => {
    setDraggedSubId(subId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(subId));
  };

  const handleSubDragOver = (e, subId) => {
    e.preventDefault();
    if (draggedSubId === null || draggedSubId === subId) return;
    setDragOverSubId(subId);
  };

  const handleSubDrop = (e, targetId) => {
    e.preventDefault();
    const sourceId = draggedSubId;
    setDraggedSubId(null);
    setDragOverSubId(null);
    if (sourceId === null || sourceId === targetId) return;
    reorderSubs(sourceId, targetId);
  };

  const handleSubDragEnd = () => {
    setDraggedSubId(null);
    setDragOverSubId(null);
  };

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

  const fileInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const processImageFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) {
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

          const items = res.subscriptions || (res.extracted ? [res.extracted] : []);
          if (items.length === 1) {
            const ext = items[0];
            setEditingSub(null);
            setFormData({
              name: ext.name || "Subscription",
              plan_type: ext.plan_type || "free_trial",
              amount: ext.amount !== undefined ? String(ext.amount) : "0",
              currency: ext.currency || "₹",
              billing_cycle: ext.billing_cycle || "monthly",
              start_date: ext.start_date || toISO(new Date()),
              renewal_date: ext.renewal_date || toISO(new Date(Date.now() + 30 * 86400000)),
              remind_days_before: ext.remind_days_before || 3,
              status: "active",
              notes: ext.notes || "Extracted from screenshot via AI",
            });
            setFormError("");
            setShowModal(true);
          } else if (items.length > 1) {
            setExtractedList(items.map((it, idx) => ({ ...it, id: `ext-${idx}`, selected: true })));
            setShowMultiModal(true);
          } else {
            alert("No subscriptions found in the image. Please try another screenshot.");
          }
        } catch (err) {
          alert(err.message || "Failed to analyze image. Please try again or fill manually.");
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setUploading(false);
    }
  };

  const handleScreenshotUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
      e.target.value = "";
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processImageFile(file);
  };

  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.indexOf("image") !== -1) {
          const file = item.getAsFile();
          if (file) processImageFile(file);
          break;
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  const handleImportMulti = async () => {
    const selectedItems = extractedList.filter((item) => item.selected);
    if (selectedItems.length === 0) return;
    setSavingMulti(true);
    try {
      await api.post("/subscriptions/bulk", { items: selectedItems });
      setShowMultiModal(false);
      setExtractedList([]);
      loadSubscriptions();
    } catch (err) {
      alert(err.message || "Failed to import subscriptions.");
    } finally {
      setSavingMulti(false);
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
    const ok = await confirm({
      title: "Delete this subscription?",
      message: "It will be removed from your list. This cannot be undone.",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await api.del(`/subscriptions/${id}`);
      loadSubscriptions();
    } catch (err) {
      toast.error(`Couldn't delete the subscription — ${err.message}`);
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

      {/* ── Drag & Drop / Mobile Photo Upload Hero ── */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload a screenshot to extract subscriptions"
        aria-disabled={uploading || undefined}
        onKeyDown={(e) => {
          // See Nptel: can't be a real <button> (wraps the file input, whole area
          // is a drop target), and role="button" doesn't bring key activation.
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!uploading) fileInputRef.current?.click();
          }
        }}
        style={{
          border: `2px dashed ${isDragOver ? "var(--accent)" : "var(--border)"}`,
          borderRadius: 14,
          padding: "20px 18px",
          textAlign: "center",
          cursor: uploading ? "wait" : "pointer",
          marginBottom: 24,
          background: isDragOver ? "var(--accent-soft)" : "var(--bg-elevated)",
          transition: "all 0.2s ease",
          transform: isDragOver ? "scale(1.015)" : "scale(1)",
          boxShadow: isDragOver ? "0 0 0 3px var(--accent-soft)" : "none",
          position: "relative",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleScreenshotUpload}
          disabled={uploading}
        />

        {uploading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--accent)" }}>
            <Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: 15, fontWeight: 600 }}>AI is reading your subscription screenshot…</span>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 6 }}>
              <Camera size={22} style={{ color: "var(--accent)" }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
                {isDragOver ? "Drop subscription photo to extract ✨" : "Scan or Upload Subscription Screenshot"}
              </span>
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
              Tap to choose photo or screenshot · drag &amp; drop on desktop ·{" "}
              <kbd style={{ fontSize: 11, padding: "1px 5px", borderRadius: 4, background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                Ctrl+V
              </kbd>{" "}
              paste
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
              <Sparkles size={11} style={{ color: "var(--accent)" }} />
              AI auto-extracts all service names, amounts, plan types &amp; renewal dates
            </div>
          </>
        )}
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

      {/* A card changing position is a purely visual cue, so mirror it in text
          for screen readers. */}
      <div className="sr-only" role="status" aria-live="polite">
        {reorderMessage}
      </div>

      {!loading && filteredSubs.length > 0 && (
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))" }}>
          {filteredSubs.map((sub, index) => {
            const daysLeft = Number(sub.days_remaining);
            const isTrial = sub.plan_type === "free_trial";
            const isCancelled = sub.status === "cancelled";
            const isUrgent = !isCancelled && daysLeft >= 0 && daysLeft <= 5;
            const isDragging = draggedSubId === sub.id;
            const isDragTarget = dragOverSubId === sub.id;

            return (
              <div
                key={sub.id}
                className="card"
                draggable
                onDragStart={(e) => handleSubDragStart(e, sub.id)}
                onDragOver={(e) => handleSubDragOver(e, sub.id)}
                onDrop={(e) => handleSubDrop(e, sub.id)}
                onDragEnd={handleSubDragEnd}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  border: isDragTarget ? "2px solid var(--accent)" : isUrgent ? "1px solid var(--warning)" : isCancelled ? "1px solid var(--border-color)" : undefined,
                  opacity: isDragging ? 0.45 : isCancelled ? 0.75 : 1,
                  transform: isDragTarget ? "scale(1.01)" : "scale(1)",
                  transition: "all 0.15s ease",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Top Badge Banner */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flex: 1, minWidth: 0 }}>
                      <span
                        className="sub-drag-handle"
                        title="Drag to reorder subscriptions"
                        style={{
                          color: "var(--accent)",
                          background: "var(--accent-soft)",
                          padding: "5px 6px",
                          borderRadius: 8,
                          cursor: "grab",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          marginTop: 1,
                        }}
                        onClick={(e) => e.stopPropagation()}
                        aria-hidden="true"
                      >
                        <GripVertical size={18} />
                      </span>
                      {/* Cards wrap into a responsive grid, so the neighbouring
                          item may be to the left or on the row above — hence
                          "earlier/later" rather than "up/down". */}
                      <ReorderControls
                        itemName={sub.name}
                        position={index + 1}
                        total={filteredSubs.length}
                        prevLabel="earlier"
                        nextLabel="later"
                        onPrev={() => moveSub(sub.id, -1)}
                        onNext={() => moveSub(sub.id, 1)}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
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
                      aria-label={`Edit ${sub.name}`}
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(sub.id)}
                      style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 6 }}
                      title="Delete"
                      aria-label={`Delete ${sub.name}`}
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
            {...formDialog.dialogProps}
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
              <h2 {...formDialog.titleProps} style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                {editingSub ? "Edit Subscription" : "Add Subscription"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                aria-label="Close dialog"
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

      {/* Multi-Subscription Import Preview Modal */}
      {showMultiModal && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(4px)" }}>
          <div className="card" {...importDialog.dialogProps} style={{ maxWidth: 540, width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, boxShadow: "var(--shadow)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 {...importDialog.titleProps} style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Found {extractedList.length} Subscriptions</h3>
                <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                  Select which subscriptions you want to import into your tracker.
                </p>
              </div>
              <button className="btn-ghost btn" aria-label="Close dialog" style={{ padding: "4px 8px" }} onClick={() => setShowMultiModal(false)}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingRight: 4, marginBottom: 16 }}>
              {extractedList.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: 12,
                    borderRadius: 10,
                    border: item.selected ? "1px solid var(--accent)" : "1px solid var(--border)",
                    background: item.selected ? "var(--accent-soft)" : "var(--bg)",
                    transition: "all 0.15s ease",
                  }}
                >
                  <input
                    type="checkbox"
                    className="custom-checkbox"
                    checked={item.selected}
                    onChange={() => {
                      setExtractedList((prev) =>
                        prev.map((it) => (it.id === item.id ? { ...it, selected: !it.selected } : it))
                      );
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {item.currency}{item.amount} / {item.billing_cycle} · Renews {item.renewal_date}
                    </div>
                    {item.notes && <div style={{ fontSize: 11, color: "var(--text-muted)", opacity: 0.8, marginTop: 2 }}>{item.notes}</div>}
                  </div>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: item.plan_type === "free_trial" ? "rgba(234,179,8,0.15)" : "rgba(59,130,246,0.15)", color: item.plan_type === "free_trial" ? "#eab308" : "#3b82f6", fontWeight: 600 }}>
                    {item.plan_type === "free_trial" ? "Free Trial" : "Paid"}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
              <button
                type="button"
                className="btn-ghost btn"
                style={{ fontSize: 12 }}
                onClick={() => {
                  const allSelected = extractedList.every((it) => it.selected);
                  setExtractedList((prev) => prev.map((it) => ({ ...it, selected: !allSelected })));
                }}
              >
                {extractedList.every((it) => it.selected) ? "Deselect All" : "Select All"}
              </button>

              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost" type="button" onClick={() => setShowMultiModal(false)}>Cancel</button>
                <button
                  className="btn"
                  type="button"
                  disabled={savingMulti || extractedList.filter((it) => it.selected).length === 0}
                  onClick={handleImportMulti}
                >
                  {savingMulti ? "Importing…" : `Import ${extractedList.filter((it) => it.selected).length} Subscription(s)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
