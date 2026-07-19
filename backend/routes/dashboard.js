import express from "express";
import { getPool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { toISO } from "../utils/dateHelpers.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();
router.use(requireAuth);

router.get("/", asyncHandler(async (req, res) => {
  const pool = getPool();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toISO(today);

  const todosResult = await pool.query(
    "SELECT * FROM todos WHERE user_id = $1 ORDER BY date DESC",
    [req.userId]
  );
  const byDate = {};
  for (const t of todosResult.rows) {
    if (!byDate[t.date]) byDate[t.date] = [];
    byDate[t.date].push(t);
  }

  let streak = 0;
  let cursor = new Date(today);
  const todayTodos = byDate[todayStr];
  if (todayTodos && todayTodos.length > 0 && todayTodos.every((t) => t.done)) {
    streak += 1;
  }
  cursor.setDate(cursor.getDate() - 1);
  let taskGuard = 0;
  while (taskGuard < 730) {
    taskGuard += 1;
    const key = toISO(cursor);
    const dayTodos = byDate[key];
    if (dayTodos && dayTodos.length > 0 && dayTodos.every((t) => t.done)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  const pendingToday = (byDate[todayStr] || []).filter((t) => !t.done).length;
  const totalPendingUpcoming = todosResult.rows.filter((t) => !t.done && t.date >= todayStr).length;

  const recordsResult = await pool.query(
    "SELECT * FROM day_attendance WHERE user_id = $1 ORDER BY date DESC",
    [req.userId]
  );
  const recByDate = {};
  for (const r of recordsResult.rows) {
    recByDate[r.date] = r;
  }
  const holidaysResult = await pool.query(
    "SELECT date FROM college_holidays WHERE user_id = $1",
    [req.userId]
  );
  const holidaySet = new Set(holidaysResult.rows.map((h) => h.date));

  let attendanceStreak = 0;
  let aCursor = new Date(today);
  let guard = 0;
  while (guard < 730) {
    guard += 1;
    const key = toISO(aCursor);
    if (holidaySet.has(key)) {
      // No college that day — doesn't break the streak, just doesn't count towards it either.
      aCursor.setDate(aCursor.getDate() - 1);
      continue;
    }
    const rec = recByDate[key];
    if (rec && rec.status === "present") {
      attendanceStreak += 1;
      aCursor.setDate(aCursor.getDate() - 1);
    } else {
      break;
    }
  }

  res.json({
    date: todayStr,
    taskStreak: streak,
    attendanceStreak,
    pendingToday,
    totalPendingUpcoming,
  });
}));

export default router;
