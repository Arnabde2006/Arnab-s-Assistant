import { useEffect, useState, useRef } from "react";
import { api } from "../api/client.js";
import { fileToBase64, fileToArrayBuffer } from "../utils/fileToBase64.js";
import { useAuth } from "../context/AuthContext.jsx";
import FileUpload from "../components/FileUpload.jsx";
import { Pencil, Trash2, Lock } from "lucide-react";

async function extractPdfText(arrayBuffer, password = "") {
  if (!window.pdfjsLib) {
    throw new Error("PDF parser library is loading. Please try again in a moment.");
  }
  // Create a copy of arrayBuffer because PDF.js worker detaches the underlying buffer
  const bufferCopy = arrayBuffer.slice(0);
  const loadingTask = window.pdfjsLib.getDocument({
    data: new Uint8Array(bufferCopy),
    password: password || undefined,
  });

  const pdf = await loadingTask.promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((item) => item.str);
    fullText += `\n--- Page ${i} ---\n` + strings.join(" ");
  }
  return fullText;
}

const CATEGORY_LABELS = {
  food: "Food",
  hostel: "Hostel/Rent",
  travel: "Travel",
  subscriptions: "Subscriptions",
  shopping: "Shopping",
  education: "Education",
  entertainment: "Entertainment",
  family: "Family",
  other: "Other",
};

const MONTH_NAMES_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function rupees(n) {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatNice(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const showYear = d.getFullYear() !== now.getFullYear();
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", ...(showYear ? { year: "numeric" } : {}) });
}

function formatMonthName(monthStr) {
  if (!monthStr) return "";
  const [y, m] = monthStr.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function shiftMonth(monthStr, delta) {
  const [y, m] = monthStr.split("-");
  const date = new Date(Number(y), Number(m) - 1 + delta, 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function ThemeMonthPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => {
    const [y] = (value || new Date().toISOString().slice(0, 7)).split("-");
    return Number(y);
  });
  const pickerRef = useRef(null);

  const [selectedY, selectedM] = (value || new Date().toISOString().slice(0, 7)).split("-");

  useEffect(() => {
    function handleClickOutside(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (value) {
      const [y] = value.split("-");
      setYear(Number(y));
    }
  }, [value]);

  const monthName = formatMonthName(value);

  return (
    <div ref={pickerRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        className="btn-ghost btn"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          fontWeight: 600,
          padding: "6px 14px",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius-sm)",
          color: "var(--text)",
          cursor: "pointer",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span>{monthName}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 100,
            width: 250,
            padding: 12,
            borderRadius: "var(--radius-sm)",
            background: "var(--panel)",
            border: "1px solid var(--border-strong)",
            boxShadow: "var(--shadow)",
            backdropFilter: "blur(16px)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <button
              type="button"
              className="btn-ghost btn"
              style={{ padding: "2px 8px", fontSize: 13 }}
              onClick={() => setYear((y) => y - 1)}
            >
              ‹
            </button>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{year}</span>
            <button
              type="button"
              className="btn-ghost btn"
              style={{ padding: "2px 8px", fontSize: 13 }}
              onClick={() => setYear((y) => y + 1)}
            >
              ›
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 10 }}>
            {MONTH_NAMES_SHORT.map((mShort, idx) => {
              const mNum = String(idx + 1).padStart(2, "0");
              const monthVal = `${year}-${mNum}`;
              const isSelected = selectedY === String(year) && selectedM === mNum;
              const isCurrent = new Date().toISOString().slice(0, 7) === monthVal;

              return (
                <button
                  key={mShort}
                  type="button"
                  onClick={() => {
                    onChange(monthVal);
                    setOpen(false);
                  }}
                  style={{
                    padding: "7px 0",
                    fontSize: 12,
                    fontWeight: isSelected ? 700 : 500,
                    borderRadius: 6,
                    border: isSelected ? "1px solid var(--accent)" : isCurrent ? "1px solid var(--border-strong)" : "1px solid transparent",
                    background: isSelected ? "var(--accent)" : "var(--bg-elevated)",
                    color: isSelected ? "var(--accent-text)" : "var(--text)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {mShort}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", justifyContent: "center", borderTop: "1px solid var(--border-strong)", paddingTop: 8 }}>
            <button
              type="button"
              className="btn-ghost btn"
              style={{ fontSize: 11, padding: "3px 10px" }}
              onClick={() => {
                const now = new Date().toISOString().slice(0, 7);
                onChange(now);
                setOpen(false);
              }}
            >
              This Month
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Finance() {
  const { user, setUser } = useAuth();
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [txFilter, setTxFilter] = useState("all"); // "all" or "month"
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const currentMonthStr = new Date().toISOString().slice(0, 7);

  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), amount: "", type: "expense", category: "food", merchant: "", notes: "" });

  const [file, setFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadResult, setUploadResult] = useState(null);

  // PDF Password Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pdfPassword, setPdfPassword] = useState("");
  const [pdfPasswordError, setPdfPasswordError] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingBuffer, setPendingBuffer] = useState(null);

  const [budgetInput, setBudgetInput] = useState(user?.monthlyBudget ?? "");
  const [budgetSaving, setBudgetSaving] = useState(false);

  async function refresh(m = selectedMonth) {
    const [sum, tx] = await Promise.all([
      api.get(`/finance/summary?month=${m}`),
      api.get("/finance/transactions"),
    ]);
    setSummary(sum);
    setTransactions(tx.transactions);
  }

  useEffect(() => {
    refresh(selectedMonth).catch(() => {});
  }, [selectedMonth]);

  async function addTransaction(e) {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) return;
    await api.post("/finance/transactions", { ...form, amount: Number(form.amount) });
    setForm((f) => ({ ...f, amount: "", merchant: "", notes: "" }));
    refresh(selectedMonth);
  }

  async function updateTransaction(id, patch) {
    await api.put(`/finance/transactions/${id}`, patch);
    refresh(selectedMonth);
  }

  async function removeTransaction(id) {
    await api.del(`/finance/transactions/${id}`);
    setSelectedIds((prev) => prev.filter((i) => i !== id));
    refresh(selectedMonth);
  }

  async function uploadStatement(e, providedPassword = null) {
    if (e) e.preventDefault();
    const targetFile = file || pendingFile;
    if (!targetFile) {
      setUploadError("Choose a bank statement PDF or a UPI screenshot first.");
      return;
    }
    setUploadError("");
    setUploadResult(null);
    setUploadLoading(true);

    try {
      const isPdf = targetFile.type === "application/pdf" || targetFile.name.toLowerCase().endsWith(".pdf");

      if (isPdf) {
        let buffer = pendingBuffer;
        if (!buffer || buffer.byteLength === 0) {
          buffer = await fileToArrayBuffer(targetFile);
          setPendingBuffer(buffer);
        }

        const pwdToTry = providedPassword !== null ? providedPassword : pdfPassword;

        let pdfText;
        try {
          pdfText = await extractPdfText(buffer, pwdToTry);
          // Password succeeded — close modal immediately
          setShowPasswordModal(false);
          setPdfPassword("");
          setPdfPasswordError("");
        } catch (pdfErr) {
          const isPasswordRequired =
            pdfErr.name === "PasswordException" ||
            pdfErr.code === 1 ||
            (pdfErr.message && pdfErr.message.toLowerCase().includes("password"));

          if (isPasswordRequired) {
            setPendingFile(targetFile);
            setShowPasswordModal(true);
            setPdfPasswordError(providedPassword !== null ? "Incorrect password. Please try again." : "");
            setUploadLoading(false);
            return;
          } else {
            setShowPasswordModal(false);
            throw pdfErr;
          }
        }

        const result = await api.post("/finance/upload", { pdfText });
        setUploadResult(result);
        setFile(null);
        setPendingFile(null);
        setPendingBuffer(null);
        refresh(selectedMonth);
      } else {
        const fileBase64 = await fileToBase64(targetFile);
        const result = await api.post("/finance/upload", { fileBase64, mimeType: targetFile.type });
        setUploadResult(result);
        setFile(null);
        refresh(selectedMonth);
      }
    } catch (err) {
      setShowPasswordModal(false);
      setUploadError(err.message || "Failed to process bank statement.");
    } finally {
      setUploadLoading(false);
    }
  }

  async function saveBudget(e) {
    e.preventDefault();
    setBudgetSaving(true);
    try {
      const value = budgetInput === "" ? null : Number(budgetInput);
      const data = await api.put("/auth/me", { monthlyBudget: value });
      setUser(data.user);
      refresh(selectedMonth);
    } finally {
      setBudgetSaving(false);
    }
  }

  const maxCategory = summary?.categories?.[0]?.amount || 1;
  const filteredTransactions = txFilter === "month"
    ? transactions.filter((t) => t.date && t.date.startsWith(selectedMonth))
    : transactions;

  const isCurrentMonth = selectedMonth === currentMonthStr;

  function toggleSelectAll() {
    const visibleIds = filteredTransactions.slice(0, 60).map((t) => t.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  }

  function toggleSelectOne(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  async function handleBulkCategoryChange(e) {
    e.preventDefault();
    if (!bulkCategory || selectedIds.length === 0) return;
    setBulkUpdating(true);
    try {
      await api.put("/finance/transactions/bulk", { ids: selectedIds, category: bulkCategory });
      setSelectedIds([]);
      setBulkCategory("");
      refresh(selectedMonth);
    } finally {
      setBulkUpdating(false);
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected transaction(s)?`)) return;
    setBulkUpdating(true);
    try {
      await api.del("/finance/transactions/bulk", { ids: selectedIds });
      setSelectedIds([]);
      refresh(selectedMonth);
    } finally {
      setBulkUpdating(false);
    }
  }

  return (
    <div>
      <div className="page-header" style={{ flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="page-title">Finance</h1>
          <p className="page-subtitle">Track spending, upload statements, and see where your money goes.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn-ghost btn"
            style={{ padding: "6px 12px", fontSize: 13 }}
            onClick={() => setSelectedMonth((m) => shiftMonth(m, -1))}
            title="Previous month"
          >
            ‹ Prev
          </button>
          <ThemeMonthPicker value={selectedMonth} onChange={setSelectedMonth} />
          <button
            type="button"
            className="btn-ghost btn"
            style={{ padding: "6px 12px", fontSize: 13 }}
            onClick={() => setSelectedMonth((m) => shiftMonth(m, 1))}
            title="Next month"
          >
            Next ›
          </button>
          {!isCurrentMonth && (
            <button
              type="button"
              className="btn"
              style={{ padding: "6px 12px", fontSize: 12 }}
              onClick={() => setSelectedMonth(currentMonthStr)}
            >
              This month
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="label">{isCurrentMonth ? "Spent this month" : `Spent in ${formatMonthName(selectedMonth)}`}</div>
          <div className="stat-num">{summary ? rupees(summary.expense) : "—"}</div>
        </div>
        <div className="card">
          <div className="label">{isCurrentMonth ? "Income this month" : `Income in ${formatMonthName(selectedMonth)}`}</div>
          <div className="stat-num">{summary ? rupees(summary.income) : "—"}</div>
        </div>
        <div className="card">
          <div className="label">{isCurrentMonth ? "Net this month" : `Net in ${formatMonthName(selectedMonth)}`}</div>
          <div className="stat-num" style={{ color: summary && summary.net < 0 ? "var(--absent)" : "var(--text)" }}>
            {summary ? rupees(summary.net) : "—"}
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="label" style={{ marginBottom: 12 }}>
            {isCurrentMonth ? "Spending by category" : `Spending in ${formatMonthName(selectedMonth)}`}
          </div>
          {(!summary || summary.categories.length === 0) && (
            <div className="empty-state">No expenses logged for {formatMonthName(selectedMonth)} yet.</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {summary?.categories.map((c) => (
              <div key={c.category}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                  <span>{CATEGORY_LABELS[c.category] || c.category}</span>
                  <span style={{ color: "var(--text-muted)" }}>{rupees(c.amount)}</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: "var(--bg-elevated)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(c.amount / maxCategory) * 100}%`, background: "var(--accent)", borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="label" style={{ marginBottom: 12 }}>Monthly budget</div>
          {summary?.monthlyBudget ? (
            <>
              <div style={{ fontSize: 13, marginBottom: 8 }}>
                {rupees(summary.expense)} of {rupees(summary.monthlyBudget)} spent
                {summary.budgetRemaining >= 0
                  ? ` · ${rupees(summary.budgetRemaining)} left`
                  : ` · ${rupees(-summary.budgetRemaining)} over`}
              </div>
              <div style={{ height: 8, borderRadius: 4, background: "var(--bg-elevated)", overflow: "hidden", marginBottom: 14 }}>
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(summary.budgetPercentUsed, 100)}%`,
                    background: summary.budgetPercentUsed >= 100 ? "var(--absent)" : summary.budgetPercentUsed >= 80 ? "#C9A227" : "var(--present)",
                    borderRadius: 4,
                  }}
                />
              </div>
            </>
          ) : (
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>No budget set — tracking only.</p>
          )}
          <form onSubmit={saveBudget} style={{ display: "flex", gap: 8 }}>
            <input
              className="input"
              type="number"
              min="1"
              placeholder="e.g. 8000"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
            />
            <button className="btn" type="submit" disabled={budgetSaving}>Save</button>
          </form>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <form onSubmit={addTransaction} className="card">
          <div className="label" style={{ marginBottom: 12 }}>Add a transaction</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <button type="button" className={form.type === "expense" ? "btn" : "btn-ghost btn"} style={{ background: form.type === "expense" ? "var(--absent)" : undefined, borderColor: form.type === "expense" ? "var(--absent)" : undefined }} onClick={() => setForm((f) => ({ ...f, type: "expense" }))}>Expense</button>
            <button type="button" className={form.type === "income" ? "btn" : "btn-ghost btn"} style={{ background: form.type === "income" ? "var(--present)" : undefined, borderColor: form.type === "income" ? "var(--present)" : undefined }} onClick={() => setForm((f) => ({ ...f, type: "income" }))}>Income</button>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <input className="input" type="number" min="0.01" step="0.01" placeholder="Amount (₹)" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} style={{ flex: "1 1 120px" }} required />
            <input className="input" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} style={{ flex: "1 1 140px" }} />
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <select className="input" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} style={{ flex: "1 1 140px" }}>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <input className="input" placeholder="Merchant / description" value={form.merchant} onChange={(e) => setForm((f) => ({ ...f, merchant: e.target.value }))} style={{ flex: "1 1 140px" }} />
          </div>
          <button className="btn" type="submit" style={{ width: "100%" }}>Add</button>
        </form>

        <form onSubmit={uploadStatement} className="card">
          <div className="label" style={{ marginBottom: 8 }}>Upload statement or UPI screenshot</div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
            A bank statement PDF or a Google Pay/PhonePe/Paytm payment screenshot — transactions are auto-added and categorized, and you can edit or delete any of them below.
            <br />
            <span style={{ fontSize: 11, color: "var(--accent)", display: "inline-block", marginTop: 4 }}>
              💡 <strong>Password-protected PDFs supported:</strong> If your bank statement is encrypted, simply upload it and enter your PDF password when prompted!
            </span>
          </p>
          <FileUpload
            id="finance-upload"
            accept="image/*,application/pdf"
            file={file}
            onChange={setFile}
            placeholder="Drag & drop your bank statement or UPI screenshot here, or click to browse"
            helpText="Supports bank statement PDF or Google Pay / PhonePe / Paytm screenshot"
          />
          <div style={{ height: 12 }} />
          {uploadError && <div className="error-text" style={{ marginBottom: 10 }}>{uploadError}</div>}
          {uploadResult && (
            <div style={{ fontSize: 12, color: "var(--present)", marginBottom: 10 }}>
              {uploadResult.count > 0 ? `Added ${uploadResult.count} new transaction(s).` : "No new transactions to add."}
              {uploadResult.skippedCount > 0 && ` Skipped ${uploadResult.skippedCount} existing duplicate(s).`}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <button className="btn" type="submit" disabled={uploadLoading} style={{ minWidth: 140 }}>
              {uploadLoading ? "Reading…" : "Upload"}
            </button>
          </div>
        </form>

      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div className="label" style={{ margin: 0 }}>
              {txFilter === "month" ? `Transactions in ${formatMonthName(selectedMonth)}` : "All transactions"}
            </div>
            {selectionMode && filteredTransactions.length > 0 && (
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer", color: "var(--text-muted)", userSelect: "none" }}>
                <input
                  type="checkbox"
                  className="custom-checkbox"
                  checked={
                    filteredTransactions.length > 0 &&
                    filteredTransactions.slice(0, 60).every((t) => selectedIds.includes(t.id))
                  }
                  onChange={toggleSelectAll}
                />
                Select All
              </label>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className={selectionMode ? "btn" : "btn-ghost btn"}
              style={{ fontSize: 12, padding: "5px 12px", display: "flex", alignItems: "center", gap: 5 }}
              onClick={() => {
                if (selectionMode) {
                  setSelectionMode(false);
                  setSelectedIds([]);
                } else {
                  setSelectionMode(true);
                }
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 11 12 14 22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              {selectionMode ? "Exit Selection" : "Bulk Edit / Select"}
            </button>
            <div style={{ width: 1, height: 16, background: "var(--border-strong)" }} />
            <button
              type="button"
              className={txFilter === "all" ? "btn" : "btn-ghost btn"}
              style={{ fontSize: 11, padding: "4px 10px" }}
              onClick={() => setTxFilter("all")}
            >
              All ({transactions.length})
            </button>
            <button
              type="button"
              className={txFilter === "month" ? "btn" : "btn-ghost btn"}
              style={{ fontSize: 11, padding: "4px 10px" }}
              onClick={() => setTxFilter("month")}
            >
              {formatMonthName(selectedMonth)} ({transactions.filter((t) => t.date && t.date.startsWith(selectedMonth)).length})
            </button>
          </div>
        </div>

        {selectionMode && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justify: "space-between",
              gap: 12,
              flexWrap: "wrap",
              padding: "12px 16px",
              borderRadius: "var(--radius-sm)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-strong)",
              boxShadow: "var(--shadow)",
              marginBottom: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "3px 10px",
                  borderRadius: 999,
                  background: "var(--accent-soft)",
                  color: "var(--text)",
                }}
              >
                {selectedIds.length} item(s) selected
              </span>
              <form onSubmit={handleBulkCategoryChange} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <select
                  className="input"
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value)}
                  style={{ fontSize: 12, padding: "6px 12px", width: "auto", minWidth: 160 }}
                  required
                >
                  <option value="">Bulk category change to...</option>
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <button className="btn" type="submit" disabled={bulkUpdating || !bulkCategory || selectedIds.length === 0} style={{ fontSize: 12, padding: "6px 14px" }}>
                  Apply Category
                </button>
              </form>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                className="btn-ghost btn"
                style={{
                  fontSize: 12,
                  padding: "6px 12px",
                  color: "var(--absent)",
                  borderColor: "rgba(193, 85, 74, 0.3)",
                  background: "rgba(193, 85, 74, 0.08)",
                  opacity: selectedIds.length === 0 ? 0.5 : 1,
                  cursor: selectedIds.length === 0 ? "default" : "pointer",
                }}
                onClick={handleBulkDelete}
                disabled={bulkUpdating || selectedIds.length === 0}
              >
                Delete Selected
              </button>
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  className="btn-ghost btn"
                  style={{ fontSize: 12, padding: "6px 12px" }}
                  onClick={() => setSelectedIds([])}
                >
                  Deselect All
                </button>
              )}
            </div>
          </div>
        )}

        {filteredTransactions.length === 0 && (
          <div className="empty-state">
            {txFilter === "month" ? `No transactions recorded for ${formatMonthName(selectedMonth)}.` : "No transactions yet."}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filteredTransactions.slice(0, 60).map((t) => (
            <TransactionRow
              key={t.id}
              t={t}
              selectionMode={selectionMode}
              selected={selectedIds.includes(t.id)}
              onSelect={toggleSelectOne}
              onUpdate={updateTransaction}
              onDelete={removeTransaction}
            />
          ))}
        </div>
      </div>

      {/* PDF Password Modal */}
      {showPasswordModal && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(4px)" }}>
          <div className="card" style={{ maxWidth: 420, width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, boxShadow: "var(--shadow)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)" }}>
                <Lock size={20} />
              </div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--text)" }}>Password Protected PDF</h3>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 16px 0", lineHeight: 1.4 }}>
              This bank statement is encrypted. Please enter the PDF password (e.g. DOB in <code>DDMMYYYY</code> format, PAN number, or Account number) to unlock it for AI extraction.
            </p>

            <form onSubmit={(e) => { e.preventDefault(); uploadStatement(null, pdfPassword); }}>
              <input
                type="password"
                className="input"
                placeholder="Enter PDF password..."
                value={pdfPassword}
                onChange={(e) => setPdfPassword(e.target.value)}
                autoFocus
                required
                style={{ width: "100%", marginBottom: 12 }}
              />
              {pdfPasswordError && (
                <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 12, fontWeight: 500 }}>
                  {pdfPasswordError}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPendingFile(null);
                    setPendingBuffer(null);
                    setPdfPassword("");
                  }}
                >
                  Cancel
                </button>
                <button className="btn" type="submit" disabled={uploadLoading}>
                  {uploadLoading ? "Decrypting..." : "Unlock & Extract"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function TransactionRow({ t, selectionMode, selected, onSelect, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "8px 10px", borderRadius: 8, background: "var(--bg-elevated)" }}>
        <select className="input" defaultValue={t.type} style={{ flex: "1 1 100px" }} onChange={(e) => onUpdate(t.id, { type: e.target.value })}>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
        <select className="input" defaultValue={t.category} style={{ flex: "1 1 130px" }} onChange={(e) => onUpdate(t.id, { category: e.target.value })}>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <input className="input" type="number" defaultValue={t.amount} style={{ flex: "1 1 100px" }} onBlur={(e) => onUpdate(t.id, { amount: Number(e.target.value) })} />
        <button type="button" className="btn-ghost btn" style={{ fontSize: 12, padding: "6px 10px" }} onClick={() => setEditing(false)}>Done</button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        justify: "space-between",
        alignItems: "center",
        padding: "8px 12px",
        borderRadius: 8,
        background: selected ? "var(--accent-soft)" : "var(--bg-elevated)",
        gap: 10,
        flexWrap: "wrap",
        border: selected ? "1px solid var(--accent)" : "1px solid transparent",
        transition: "background 0.15s ease, border-color 0.15s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: "1 1 160px" }}>
        {selectionMode && (
          <input
            type="checkbox"
            className="custom-checkbox"
            checked={selected}
            onChange={() => onSelect(t.id)}
          />
        )}
        <div style={{ fontSize: 13, wordBreak: "break-word" }}>
          {t.merchant || CATEGORY_LABELS[t.category] || t.category}
          <span style={{ color: "var(--text-muted)" }}> · {formatNice(t.date)} · {CATEGORY_LABELS[t.category] || t.category}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span style={{ fontWeight: 600, color: t.type === "income" ? "var(--present)" : "var(--absent)" }}>
          {t.type === "income" ? "+" : "−"}{rupees(t.amount)}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="btn-ghost btn tx-action-btn"
          style={{ fontSize: 11, padding: "5px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}
          title="Edit transaction"
        >
          <Pencil size={13} />
          <span className="tx-action-text">Edit</span>
        </button>
        <button
          type="button"
          onClick={() => onDelete(t.id)}
          className="btn-ghost btn tx-action-btn"
          style={{ fontSize: 11, padding: "5px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}
          title="Delete transaction"
        >
          <Trash2 size={13} />
          <span className="tx-action-text">Delete</span>
        </button>
      </div>
    </div>
  );
}
