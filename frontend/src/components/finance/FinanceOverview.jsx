import React from "react";
import { rupees } from "../../utils/format.js";

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

export default function FinanceOverview({
  summary,
  selectedMonth,
  formatMonthName,
  isCurrentMonth,
  budgetInput,
  setBudgetInput,
  budgetSaving,
  saveBudget,
}) {
  const maxCategory = summary?.categories?.[0]?.amount || 1;

  return (
    <>
      {/* 3 Summary Stat Cards */}
      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="label">
            {isCurrentMonth ? "Spent this month" : `Spent in ${formatMonthName(selectedMonth)}`}
          </div>
          <div className="stat-num">{summary ? rupees(summary.expense) : "—"}</div>
        </div>
        <div className="card">
          <div className="label">
            {isCurrentMonth ? "Income this month" : `Income in ${formatMonthName(selectedMonth)}`}
          </div>
          <div className="stat-num">{summary ? rupees(summary.income) : "—"}</div>
        </div>
        <div className="card">
          <div className="label">
            {isCurrentMonth ? "Net this month" : `Net in ${formatMonthName(selectedMonth)}`}
          </div>
          <div
            className="stat-num"
            style={{ color: summary && summary.net < 0 ? "var(--absent)" : "var(--text)" }}
          >
            {summary ? rupees(summary.net) : "—"}
          </div>
        </div>
      </div>

      {/* Category Breakdown & Budget Widgets */}
      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        {/* Spending by Category */}
        <div className="card">
          <div className="label" style={{ marginBottom: 12 }}>
            {isCurrentMonth ? "Spending by category" : `Spending in ${formatMonthName(selectedMonth)}`}
          </div>
          {(!summary || summary.categories.length === 0) && (
            <div className="empty-state">
              No expenses logged for {formatMonthName(selectedMonth)} yet.
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {summary?.categories.map((c) => (
              <div key={c.category}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                  <span>{CATEGORY_LABELS[c.category] || c.category}</span>
                  <span style={{ color: "var(--text-muted)" }}>{rupees(c.amount)}</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: "var(--bg-elevated)", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${(c.amount / maxCategory) * 100}%`,
                      background: "var(--accent)",
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Budget Form */}
        <div className="card">
          <div className="label" style={{ marginBottom: 12 }}>
            Monthly budget
          </div>
          {summary?.monthlyBudget ? (
            <>
              <div style={{ fontSize: 13, marginBottom: 8 }}>
                {rupees(summary.expense)} of {rupees(summary.monthlyBudget)} spent
                {summary.budgetRemaining >= 0
                  ? ` · ${rupees(summary.budgetRemaining)} left`
                  : ` · ${rupees(-summary.budgetRemaining)} over`}
              </div>
              <div
                style={{
                  height: 8,
                  borderRadius: 4,
                  background: "var(--bg-elevated)",
                  overflow: "hidden",
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(summary.budgetPercentUsed, 100)}%`,
                    background:
                      summary.budgetPercentUsed >= 100
                        ? "var(--absent)"
                        : summary.budgetPercentUsed >= 80
                        ? "#C9A227"
                        : "var(--present)",
                    borderRadius: 4,
                  }}
                />
              </div>
            </>
          ) : (
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>
              No budget set — tracking only.
            </p>
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
            <button className="btn" type="submit" disabled={budgetSaving}>
              Save
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
