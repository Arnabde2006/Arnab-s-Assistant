import express from "express";
import { getPool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { computeAttendanceSummary } from "../lib/attendanceSummary.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();
router.use(requireAuth);

// Mark or update attendance for a single day (whole day, not per-class)
router.post("/", asyncHandler(async (req, res) => {
  const { date, status } = req.body;
  if (!date || !status) {
    return res.status(400).json({ error: "date and status are required" });
  }
  if (!["present", "absent", "half_day"].includes(status)) {
    return res.status(400).json({ error: "status must be present, absent or half_day" });
  }
  const pool = getPool();
  await pool.query("DELETE FROM college_holidays WHERE user_id = $1 AND date = $2", [req.userId, date]);
  const result = await pool.query(
    `INSERT INTO day_attendance (user_id, date, status)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, date)
     DO UPDATE SET status = EXCLUDED.status
     RETURNING *`,
    [req.userId, date, status]
  );
  res.json({ record: result.rows[0] });
}));

router.get("/", asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const pool = getPool();
  const conditions = ["user_id = $1"];
  const params = [req.userId];
  if (from) {
    params.push(from);
    conditions.push(`date >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`date <= $${params.length}`);
  }
  const result = await pool.query(
    `SELECT * FROM day_attendance WHERE ${conditions.join(" AND ")} ORDER BY date DESC`,
    params
  );
  res.json({ records: result.rows });
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const pool = getPool();
  await pool.query("DELETE FROM day_attendance WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
  res.json({ success: true });
}));

// Overall summary: percentage (half day = 0.5), safe-to-miss / classes-needed against goal,
// plus the "according to college" points-based version.
router.get("/summary", asyncHandler(async (req, res) => {
  const summary = await computeAttendanceSummary(req.userId);
  res.json(summary);
}));

export default router;
