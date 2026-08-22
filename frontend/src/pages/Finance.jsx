import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { api } from "../api/client.js";
import { useAsyncAction } from "../hooks/useAsyncAction.js";
import { useDialog } from "../hooks/useDialog.js";
import { useToast } from "../context/ToastContext.jsx";
import { useConfirm } from "../context/ConfirmContext.jsx";
import { fileToBase64, fileToArrayBuffer } from "../utils/fileToBase64.js";
import { useAuth } from "../context/AuthContext.jsx";
import { pad, rupees, parseLocalDate } from "../utils/format.js";
import FinanceOverview from "../components/finance/FinanceOverview.jsx";
import FinanceImportModal from "../components/finance/FinanceImportModal.jsx";
import FinanceTransactionList from "../components/finance/FinanceTransactionList.jsx";

async function extractPdfText(arrayBuffer, password = "") {
  if (!window.pdfjsLib) {
    throw new Error("PDF parser library is loading. Please try again in a moment.");
  }
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
  const month = pad(date.getMonth() + 1);
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
              const mNum = pad(idx + 1);
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
  const [txFilter, setTxFilter] = useState("all");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const currentMonthStr = new Date().toISOString().slice(0, 7);

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    type: "expense",
    category: "food",
    merchant: "",
    notes: "",
  });

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

  const cancelPasswordModal = useCallback(() => {
    setShowPasswordModal(false);
    setPendingFile(null);
    setPendingBuffer(null);
    setPdfPassword("");
  }, []);
  const { dialogProps, titleProps } = useDialog(showPasswordModal, cancelPasswordModal);

  const [budgetInput, setBudgetInput] = useState(user?.monthlyBudget ?? "");
  const [budgetSaving, setBudgetSaving] = useState(false);

  const [loadError, setLoadError] = useState("");
  const { run } = useAsyncAction();
  const toast = useToast();
  const confirm = useConfirm();

  const refreshSummary = useCallback(async (m) => {
    const sum = await api.get(`/finance/summary?month=${m}`);
    setSummary(sum);
  }, []);

  const refreshTransactions = useCallback(async () => {
    const tx = await api.get("/finance/transactions");
    setTransactions(tx.transactions);
  }, []);

  const refresh = useCallback(
    async (m = selectedMonth) => {
      await Promise.all([refreshSummary(m), refreshTransactions()]);
    },
    [selectedMonth, refreshSummary, refreshTransactions]
  );

  useEffect(() => {
    refreshTransactions().catch((err) =>
      setLoadError(err.message || "Couldn't load your transactions.")
    );
  }, [refreshTransactions]);

  useEffect(() => {
    refreshSummary(selectedMonth).catch((err) =>
      setLoadError(err.message || "Couldn't load this month's summary.")
    );
  }, [selectedMonth, refreshSummary]);

  const retryLoad = useCallback(() => {
    setLoadError("");
    Promise.all([refreshTransactions(), refreshSummary(selectedMonth)]).catch((err) =>
      setLoadError(err.message || "Still couldn't load your finances.")
    );
  }, [refreshTransactions, refreshSummary, selectedMonth]);

  async function addTransaction(e) {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) return;
    const { ok } = await run(
      () => api.post("/finance/transactions", { ...form, amount: Number(form.amount) }),
      { errorMessage: "Couldn't add that transaction" }
    );
    if (!ok) return;
    setForm((f) => ({ ...f, amount: "", merchant: "", notes: "" }));
    await run(() => refresh(selectedMonth), { errorMessage: "Saved, but the totals may be out of date" });
  }

  const updateTransaction = useCallback(
    async (id, patch) => {
      const { ok } = await run(() => api.put(`/finance/transactions/${id}`, patch), {
        errorMessage: "Couldn't save that change",
      });
      if (ok) {
        await run(() => refresh(selectedMonth), { errorMessage: "Saved, but the totals may be out of date" });
      }
    },
    [run, refresh, selectedMonth]
  );

  const removeTransaction = useCallback(
    async (id) => {
      const { ok } = await run(() => api.del(`/finance/transactions/${id}`), {
        errorMessage: "Couldn't delete that transaction",
      });
      if (!ok) return;
      setSelectedIds((prev) => prev.filter((i) => i !== id));
      await run(() => refresh(selectedMonth), { errorMessage: "Deleted, but the totals may be out of date" });
    },
    [run, refresh, selectedMonth]
  );

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
        await refresh(selectedMonth).catch((err) =>
          toast.error(`Saved, but the totals may be out of date — ${err.message}`)
        );
      } else {
        const fileBase64 = await fileToBase64(targetFile);
        const result = await api.post("/finance/upload", { fileBase64, mimeType: targetFile.type });
        setUploadResult(result);
        setFile(null);
        await refresh(selectedMonth).catch((err) =>
          toast.error(`Saved, but the totals may be out of date — ${err.message}`)
        );
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
      await refresh(selectedMonth).catch((err) =>
        toast.error(`Saved, but the totals may be out of date — ${err.message}`)
      );
      toast.success("Monthly budget updated.");
    } catch (err) {
      toast.error(`Couldn't save your budget — ${err.message}`);
    } finally {
      setBudgetSaving(false);
    }
  }

  const filteredTransactions = useMemo(
    () =>
      txFilter === "month"
        ? transactions.filter((t) => t.date && t.date.startsWith(selectedMonth))
        : transactions,
    [transactions, txFilter, selectedMonth]
  );

  const monthTransactionCount = useMemo(
    () => transactions.filter((t) => t.date && t.date.startsWith(selectedMonth)).length,
    [transactions, selectedMonth]
  );

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

  const toggleSelectOne = useCallback((id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

  async function handleBulkCategoryChange(e) {
    e.preventDefault();
    if (!bulkCategory || selectedIds.length === 0) return;
    const count = selectedIds.length;
    setBulkUpdating(true);
    try {
      await api.put("/finance/transactions/bulk", { ids: selectedIds, category: bulkCategory });
      setSelectedIds([]);
      setBulkCategory("");
      await refresh(selectedMonth).catch((err) =>
        toast.error(`Saved, but the totals may be out of date — ${err.message}`)
      );
      toast.success(`Recategorised ${count} transaction${count === 1 ? "" : "s"}.`);
    } catch (err) {
      toast.error(`Couldn't recategorise those transactions — ${err.message}`);
    } finally {
      setBulkUpdating(false);
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;
    const ok = await confirm({
      title: `Delete ${selectedIds.length} transaction${selectedIds.length === 1 ? "" : "s"}?`,
      message: "This cannot be undone.",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    const count = selectedIds.length;
    setBulkUpdating(true);
    try {
      await api.del("/finance/transactions/bulk", { ids: selectedIds });
      setSelectedIds([]);
      await refresh(selectedMonth).catch((err) =>
        toast.error(`Saved, but the totals may be out of date — ${err.message}`)
      );
      toast.success(`Deleted ${count} transaction${count === 1 ? "" : "s"}.`);
    } catch (err) {
      toast.error(`Couldn't delete those transactions — ${err.message}`);
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

      {loadError && (
        <div className="load-error" role="alert">
          <span>{loadError}</span>
          <button type="button" className="btn btn-sm" onClick={retryLoad}>
            Retry
          </button>
        </div>
      )}

      <FinanceOverview
        summary={summary}
        selectedMonth={selectedMonth}
        formatMonthName={formatMonthName}
        isCurrentMonth={isCurrentMonth}
        budgetInput={budgetInput}
        setBudgetInput={setBudgetInput}
        budgetSaving={budgetSaving}
        saveBudget={saveBudget}
      />

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        {/* Add Transaction Form */}
        <form onSubmit={addTransaction} className="card">
          <div className="label" style={{ marginBottom: 12 }}>
            Add a transaction
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className={form.type === "expense" ? "btn" : "btn-ghost btn"}
              style={{
                background: form.type === "expense" ? "var(--absent)" : undefined,
                borderColor: form.type === "expense" ? "var(--absent)" : undefined,
              }}
              onClick={() => setForm((f) => ({ ...f, type: "expense" }))}
            >
              Expense
            </button>
            <button
              type="button"
              className={form.type === "income" ? "btn" : "btn-ghost btn"}
              style={{
                background: form.type === "income" ? "var(--present)" : undefined,
                borderColor: form.type === "income" ? "var(--present)" : undefined,
              }}
              onClick={() => setForm((f) => ({ ...f, type: "income" }))}
            >
              Income
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <input
              className="input"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Amount (₹)"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              style={{ flex: "1 1 120px" }}
              required
            />
            <input
              className="input"
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              style={{ flex: "1 1 140px" }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <select
              className="input"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              style={{ flex: "1 1 140px" }}
            >
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <input
              className="input"
              placeholder="Merchant / description"
              value={form.merchant}
              onChange={(e) => setForm((f) => ({ ...f, merchant: e.target.value }))}
              style={{ flex: "1 1 140px" }}
            />
          </div>
          <button className="btn" type="submit" style={{ width: "100%" }}>
            Add
          </button>
        </form>

        {/* Statement Upload & PDF Password Modal */}
        <FinanceImportModal
          file={file}
          setFile={setFile}
          uploadLoading={uploadLoading}
          uploadError={uploadError}
          uploadResult={uploadResult}
          uploadStatement={uploadStatement}
          showPasswordModal={showPasswordModal}
          pdfPassword={pdfPassword}
          setPdfPassword={setPdfPassword}
          pdfPasswordError={pdfPasswordError}
          cancelPasswordModal={cancelPasswordModal}
          dialogProps={dialogProps}
          titleProps={titleProps}
        />
      </div>

      <FinanceTransactionList
        transactions={transactions}
        filteredTransactions={filteredTransactions}
        selectedMonth={selectedMonth}
        formatMonthName={formatMonthName}
        txFilter={txFilter}
        setTxFilter={setTxFilter}
        monthTransactionCount={monthTransactionCount}
        selectionMode={selectionMode}
        setSelectionMode={setSelectionMode}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        toggleSelectAll={toggleSelectAll}
        toggleSelectOne={toggleSelectOne}
        bulkCategory={bulkCategory}
        setBulkCategory={setBulkCategory}
        bulkUpdating={bulkUpdating}
        handleBulkCategoryChange={handleBulkCategoryChange}
        handleBulkDelete={handleBulkDelete}
        updateTransaction={updateTransaction}
        removeTransaction={removeTransaction}
      />
    </div>
  );
}
