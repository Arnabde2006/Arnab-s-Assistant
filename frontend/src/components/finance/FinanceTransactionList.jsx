import React, { useState, memo } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { rupees, parseLocalDate } from "../../utils/format.js";

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

function formatNice(dateStr) {
  const d = parseLocalDate(dateStr);
  const showYear = d.getFullYear() !== new Date().getFullYear();
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(showYear ? { year: "numeric" } : {}),
  });
}

const TransactionRow = memo(function TransactionRow({
  t,
  selectionMode,
  selected,
  onSelect,
  onUpdate,
  onDelete,
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          padding: "8px 10px",
          borderRadius: 8,
          background: "var(--bg-elevated)",
        }}
      >
        <select
          className="input"
          defaultValue={t.type}
          style={{ flex: "1 1 100px" }}
          onChange={(e) => onUpdate(t.id, { type: e.target.value })}
        >
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
        <select
          className="input"
          defaultValue={t.category}
          style={{ flex: "1 1 130px" }}
          onChange={(e) => onUpdate(t.id, { category: e.target.value })}
        >
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <input
          className="input"
          type="number"
          defaultValue={t.amount}
          style={{ flex: "1 1 100px" }}
          onBlur={(e) => onUpdate(t.id, { amount: Number(e.target.value) })}
        />
        <button
          type="button"
          className="btn-ghost btn"
          style={{ fontSize: 12, padding: "6px 10px" }}
          onClick={() => setEditing(false)}
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
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
          <span style={{ color: "var(--text-muted)" }}>
            {" "}
            · {formatNice(t.date)} · {CATEGORY_LABELS[t.category] || t.category}
          </span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span style={{ fontWeight: 600, color: t.type === "income" ? "var(--present)" : "var(--absent)" }}>
          {t.type === "income" ? "+" : "−"}
          {rupees(t.amount)}
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
});

export default function FinanceTransactionList({
  transactions,
  filteredTransactions,
  selectedMonth,
  formatMonthName,
  txFilter,
  setTxFilter,
  monthTransactionCount,
  selectionMode,
  setSelectionMode,
  selectedIds,
  setSelectedIds,
  toggleSelectAll,
  toggleSelectOne,
  bulkCategory,
  setBulkCategory,
  bulkUpdating,
  handleBulkCategoryChange,
  handleBulkDelete,
  updateTransaction,
  removeTransaction,
}) {
  return (
    <div className="card">
      <div className="flex-between" style={{ flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div className="label" style={{ margin: 0 }}>
            {txFilter === "month"
              ? `Transactions in ${formatMonthName(selectedMonth)}`
              : "All transactions"}
          </div>
          {selectionMode && filteredTransactions.length > 0 && (
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                cursor: "pointer",
                color: "var(--text-muted)",
                userSelect: "none",
              }}
            >
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
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
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
            {formatMonthName(selectedMonth)} ({monthTransactionCount})
          </button>
        </div>
      </div>

      {selectionMode && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
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
            <form
              onSubmit={handleBulkCategoryChange}
              style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}
            >
              <select
                className="input"
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value)}
                style={{ fontSize: 12, padding: "6px 12px", width: "auto", minWidth: 160 }}
                required
              >
                <option value="">Bulk category change to...</option>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                className="btn"
                type="submit"
                disabled={bulkUpdating || !bulkCategory || selectedIds.length === 0}
                style={{ fontSize: 12, padding: "6px 14px" }}
              >
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
          {txFilter === "month"
            ? `No transactions recorded for ${formatMonthName(selectedMonth)}.`
            : "No transactions yet."}
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
  );
}
