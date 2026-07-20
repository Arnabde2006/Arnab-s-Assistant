import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { fileToBase64 } from "../utils/fileToBase64.js";
import { useAuth } from "../context/AuthContext.jsx";

const CATEGORY_LABELS = {
  food: "Food",
  hostel: "Hostel/Rent",
  travel: "Travel",
  subscriptions: "Subscriptions",
  shopping: "Shopping",
  education: "Education",
  entertainment: "Entertainment",
  other: "Other",
};

function rupees(n) {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatNice(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function Finance() {
  const { user, setUser } = useAuth();
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);

  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), amount: "", type: "expense", category: "food", merchant: "", notes: "" });

  const [file, setFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadResult, setUploadResult] = useState(null);

  const [budgetInput, setBudgetInput] = useState(user?.monthlyBudget ?? "");
  const [budgetSaving, setBudgetSaving] = useState(false);

  async function refresh() {
    const [sum, tx] = await Promise.all([api.get("/finance/summary"), api.get("/finance/transactions")]);
    setSummary(sum);
    setTransactions(tx.transactions);
  }

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  async function addTransaction(e) {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) return;
    await api.post("/finance/transactions", { ...form, amount: Number(form.amount) });
    setForm((f) => ({ ...f, amount: "", merchant: "", notes: "" }));
    refresh();
  }

  async function updateTransaction(id, patch) {
    await api.put(`/finance/transactions/${id}`, patch);
    refresh();
  }

  async function removeTransaction(id) {
    await api.del(`/finance/transactions/${id}`);
    refresh();
  }

  async function uploadStatement(e) {
    e.preventDefault();
    if (!file) {
      setUploadError("Choose a bank statement PDF or a UPI screenshot first.");
      return;
    }
    setUploadError("");
    setUploadResult(null);
    setUploadLoading(true);
    try {
      const fileBase64 = await fileToBase64(file);
      const result = await api.post("/finance/upload", { fileBase64, mimeType: file.type });
      setUploadResult(result);
      setFile(null);
      refresh();
    } catch (err) {
      setUploadError(err.message);
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
      refresh();
    } finally {
      setBudgetSaving(false);
    }
  }

  const maxCategory = summary?.categories?.[0]?.amount || 1;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Finance</h1>
          <p className="page-subtitle">Track spending, upload statements, and see where your money goes this month.</p>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="label">Spent this month</div>
          <div className="stat-num">{summary ? rupees(summary.expense) : "—"}</div>
        </div>
        <div className="card">
          <div className="label">Income this month</div>
          <div className="stat-num">{summary ? rupees(summary.income) : "—"}</div>
        </div>
        <div className="card">
          <div className="label">Net</div>
          <div className="stat-num" style={{ color: summary && summary.net < 0 ? "var(--absent)" : "var(--text)" }}>
            {summary ? rupees(summary.net) : "—"}
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="label" style={{ marginBottom: 12 }}>Spending by category</div>
          {(!summary || summary.categories.length === 0) && <div className="empty-state">No expenses logged this month yet.</div>}
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
          </p>
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ marginBottom: 10 }} />
          {uploadError && <div className="error-text" style={{ marginBottom: 10 }}>{uploadError}</div>}
          {uploadResult && (
            <div style={{ fontSize: 12, color: "var(--present)", marginBottom: 10 }}>
              Added {uploadResult.count} transaction(s) — check and edit them below if anything looks off.
            </div>
          )}
          <button className="btn" type="submit" disabled={uploadLoading}>{uploadLoading ? "Reading…" : "Upload"}</button>
        </form>
      </div>

      <div className="card">
        <div className="label" style={{ marginBottom: 12 }}>Recent transactions</div>
        {transactions.length === 0 && <div className="empty-state">No transactions yet.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {transactions.slice(0, 40).map((t) => (
            <TransactionRow key={t.id} t={t} onUpdate={updateTransaction} onDelete={removeTransaction} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TransactionRow({ t, onUpdate, onDelete }) {
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
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: 8, background: "var(--bg-elevated)", gap: 10, flexWrap: "wrap" }}>
      <div style={{ minWidth: 0, flex: "1 1 160px" }}>
        <div style={{ fontSize: 13, wordBreak: "break-word" }}>
          {t.merchant || CATEGORY_LABELS[t.category] || t.category}
          <span style={{ color: "var(--text-muted)" }}> · {formatNice(t.date)} · {CATEGORY_LABELS[t.category] || t.category}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span style={{ fontWeight: 600, color: t.type === "income" ? "var(--present)" : "var(--absent)" }}>
          {t.type === "income" ? "+" : "−"}{rupees(t.amount)}
        </span>
        <button onClick={() => setEditing(true)} className="btn-ghost btn" style={{ fontSize: 11, padding: "5px 8px" }}>Edit</button>
        <button onClick={() => onDelete(t.id)} className="btn-ghost btn" style={{ fontSize: 11, padding: "5px 8px" }}>Delete</button>
      </div>
    </div>
  );
}
