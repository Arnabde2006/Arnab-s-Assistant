import express from "express";
import { getPool } from "../db.js";
import { computeAttendanceSummary } from "../lib/attendanceSummary.js";
import { toISO } from "../utils/dateHelpers.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// NOTE: these routes are intentionally NOT behind requireAuth — they're
// looked up by an unguessable view_token instead, so a bookmarked link
// works without logging in. Everything here is read-only.
const router = express.Router();

async function findUserByToken(token) {
  const pool = getPool();
  const result = await pool.query("SELECT id, name FROM users WHERE view_token = $1", [token]);
  return result.rows[0] || null;
}

router.get("/:token", asyncHandler(async (req, res) => {
  const user = await findUserByToken(req.params.token);
  if (!user) return res.status(404).json({ error: "This view-only link isn't valid." });

  const pool = getPool();
  const today = toISO(new Date());
  const future = new Date();
  future.setDate(future.getDate() + 60);
  const futureStr = toISO(future);

  const [attendance, todosResult, examsResult, recentAttendanceResult, holidaysResult] = await Promise.all([
    computeAttendanceSummary(user.id),
    pool.query(
      "SELECT id, text, date, priority, done FROM todos WHERE user_id = $1 AND date >= $2 AND date <= $3 ORDER BY date ASC",
      [user.id, today, futureStr]
    ),
    pool.query(
      "SELECT id, course, exam_date, exam_time, notes FROM exams WHERE user_id = $1 AND exam_date >= $2 ORDER BY exam_date ASC",
      [user.id, today]
    ),
    pool.query(
      "SELECT date, status FROM day_attendance WHERE user_id = $1 ORDER BY date DESC LIMIT 14",
      [user.id]
    ),
    pool.query(
      "SELECT date, reason FROM college_holidays WHERE user_id = $1 AND date >= $2 AND date <= $3 ORDER BY date ASC",
      [user.id, today, futureStr]
    ),
  ]);

  res.json({
    name: user.name,
    attendance,
    recentAttendance: recentAttendanceResult.rows,
    todos: todosResult.rows,
    exams: examsResult.rows,
    holidays: holidaysResult.rows,
  });
}));

export default router;
