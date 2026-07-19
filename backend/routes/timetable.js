import express from "express";
import { getPool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();
router.use(requireAuth);

function toSlotDTO(row) {
  return {
    _id: row.id,
    dayOfWeek: row.day_of_week,
    startTime: row.start_time,
    endTime: row.end_time,
    room: row.room,
    subject: row.subject_id
      ? { _id: row.subject_id, name: row.subject_name, color: row.subject_color }
      : null,
  };
}

router.get("/", asyncHandler(async (req, res) => {
  const pool = getPool();
  const result = await pool.query(
    `SELECT t.*, s.name AS subject_name, s.color AS subject_color
     FROM timetable_slots t
     JOIN subjects s ON s.id = t.subject_id
     WHERE t.user_id = $1
     ORDER BY t.day_of_week ASC, t.start_time ASC`,
    [req.userId]
  );
  res.json({ slots: result.rows.map(toSlotDTO) });
}));

router.post("/", asyncHandler(async (req, res) => {
  const { subjectId, dayOfWeek, startTime, endTime, room } = req.body;
  if (!subjectId || dayOfWeek === undefined || !startTime || !endTime) {
    return res.status(400).json({ error: "subjectId, dayOfWeek, startTime and endTime are required" });
  }
  const pool = getPool();

  // Make sure the subject actually belongs to this user before linking a
  // timetable slot to it — otherwise a guessed/leaked subject UUID from
  // another account could be referenced here.
  const ownsSubject = await pool.query("SELECT id FROM subjects WHERE id = $1 AND user_id = $2", [subjectId, req.userId]);
  if (ownsSubject.rows.length === 0) {
    return res.status(404).json({ error: "Subject not found" });
  }

  const insertResult = await pool.query(
    `INSERT INTO timetable_slots (user_id, subject_id, day_of_week, start_time, end_time, room)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [req.userId, subjectId, dayOfWeek, startTime, endTime, room || ""]
  );
  const result = await pool.query(
    `SELECT t.*, s.name AS subject_name, s.color AS subject_color
     FROM timetable_slots t JOIN subjects s ON s.id = t.subject_id
     WHERE t.id = $1 AND t.user_id = $2`,
    [insertResult.rows[0].id, req.userId]
  );
  res.status(201).json({ slot: toSlotDTO(result.rows[0]) });
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const pool = getPool();
  await pool.query("DELETE FROM timetable_slots WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
  res.json({ success: true });
}));

export default router;
