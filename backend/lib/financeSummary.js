import { getPool } from "../db.js";

const CATEGORIES = ["food", "hostel", "travel", "subscriptions", "shopping", "education", "entertainment", "other"];

export function isValidCategory(cat) {
  return CATEGORIES.includes(cat);
}

export async function computeFinanceSummary(userId, monthStr) {
  const month = monthStr || new Date().toISOString().slice(0, 7);
  const from = `${month}-01`;
  const toDate = new Date(`${from}T00:00:00`);
  toDate.setMonth(toDate.getMonth() + 1);
  const to = toDate.toISOString().slice(0, 10);

  const pool = getPool();
  const [txResult, userResult] = await Promise.all([
    pool.query(
      "SELECT * FROM transactions WHERE user_id = $1 AND date >= $2 AND date < $3 ORDER BY date DESC, created_at DESC",
      [userId, from, to]
    ),
    pool.query("SELECT monthly_budget FROM users WHERE id = $1", [userId]),
  ]);

  const rows = txResult.rows;
  const income = rows.filter((r) => r.type === "income").reduce((sum, r) => sum + Number(r.amount), 0);
  const expense = rows.filter((r) => r.type === "expense").reduce((sum, r) => sum + Number(r.amount), 0);

  const byCategory = {};
  for (const r of rows) {
    if (r.type !== "expense") continue;
    byCategory[r.category] = (byCategory[r.category] || 0) + Number(r.amount);
  }
  const categories = Object.entries(byCategory)
    .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);

  const monthlyBudget = userResult.rows[0]?.monthly_budget ? Number(userResult.rows[0].monthly_budget) : null;

  return {
    month,
    income: Math.round(income * 100) / 100,
    expense: Math.round(expense * 100) / 100,
    net: Math.round((income - expense) * 100) / 100,
    categories,
    monthlyBudget,
    budgetRemaining: monthlyBudget !== null ? Math.round((monthlyBudget - expense) * 100) / 100 : null,
    budgetPercentUsed: monthlyBudget ? Math.round((expense / monthlyBudget) * 1000) / 10 : null,
  };
}

export { CATEGORIES };
