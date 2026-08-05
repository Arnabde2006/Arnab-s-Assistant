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
    instructor: row.instructor || "",
    className: row.class_name || "1st Year",
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
  const { subjectId, subjectName, dayOfWeek, startTime, endTime, room, instructor, className } = req.body;
  if ((!subjectId && !subjectName) || dayOfWeek === undefined || !startTime || !endTime) {
    return res.status(400).json({ error: "subject, dayOfWeek, startTime and endTime are required" });
  }
  const pool = getPool();
  let finalSubjectId = subjectId;

  if (!finalSubjectId || finalSubjectId === "NEW") {
    if (!subjectName || !subjectName.trim()) {
      return res.status(400).json({ error: "Subject name is required" });
    }
    const cleanName = subjectName.trim();
    const existing = await pool.query("SELECT id FROM subjects WHERE user_id = $1 AND LOWER(name) = LOWER($2)", [req.userId, cleanName]);
    if (existing.rows.length > 0) {
      finalSubjectId = existing.rows[0].id;
    } else {
      const colors = ["#3968db", "#4fa88a", "#c1554a", "#9b51e0", "#f2994a", "#2d9cdb", "#eb5757"];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const created = await pool.query("INSERT INTO subjects (user_id, name, color) VALUES ($1, $2, $3) RETURNING id", [req.userId, cleanName, color]);
      finalSubjectId = created.rows[0].id;
    }
  } else {
    const ownsSubject = await pool.query("SELECT id FROM subjects WHERE id = $1 AND user_id = $2", [finalSubjectId, req.userId]);
    if (ownsSubject.rows.length === 0) {
      return res.status(404).json({ error: "Subject not found" });
    }
  }

  const slotClassName = (className && className.trim()) ? className.trim() : "1st Year";

  const insertResult = await pool.query(
    `INSERT INTO timetable_slots (user_id, subject_id, day_of_week, start_time, end_time, room, instructor, class_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [req.userId, finalSubjectId, dayOfWeek, startTime, endTime, room || "", instructor || "", slotClassName]
  );
  const result = await pool.query(
    `SELECT t.*, s.name AS subject_name, s.color AS subject_color
     FROM timetable_slots t JOIN subjects s ON s.id = t.subject_id
     WHERE t.id = $1 AND t.user_id = $2`,
    [insertResult.rows[0].id, req.userId]
  );
  res.status(201).json({ slot: toSlotDTO(result.rows[0]) });
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { subjectId, subjectName, dayOfWeek, startTime, endTime, room, instructor, className } = req.body;

  const pool = getPool();
  const existingSlot = await pool.query(
    "SELECT id FROM timetable_slots WHERE id = $1 AND user_id = $2",
    [id, req.userId]
  );
  if (existingSlot.rows.length === 0) {
    return res.status(404).json({ error: "Slot not found" });
  }

  let finalSubjectId = subjectId;
  if (!finalSubjectId || finalSubjectId === "NEW") {
    if (!subjectName || !subjectName.trim()) {
      return res.status(400).json({ error: "Subject name is required" });
    }
    const cleanName = subjectName.trim();
    const existing = await pool.query("SELECT id FROM subjects WHERE user_id = $1 AND LOWER(name) = LOWER($2)", [req.userId, cleanName]);
    if (existing.rows.length > 0) {
      finalSubjectId = existing.rows[0].id;
    } else {
      const colors = ["#3968db", "#4fa88a", "#c1554a", "#9b51e0", "#f2994a", "#2d9cdb", "#eb5757"];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const created = await pool.query("INSERT INTO subjects (user_id, name, color) VALUES ($1, $2, $3) RETURNING id", [req.userId, cleanName, color]);
      finalSubjectId = created.rows[0].id;
    }
  }

  const slotClassName = (className && className.trim()) ? className.trim() : "BCA 2A";

  await pool.query(
    `UPDATE timetable_slots 
     SET subject_id = $1, day_of_week = $2, start_time = $3, end_time = $4, room = $5, instructor = $6, class_name = $7
     WHERE id = $8 AND user_id = $9`,
    [finalSubjectId, dayOfWeek, startTime, endTime, room || "", instructor || "", slotClassName, id, req.userId]
  );

  const result = await pool.query(
    `SELECT t.*, s.name AS subject_name, s.color AS subject_color
     FROM timetable_slots t JOIN subjects s ON s.id = t.subject_id
     WHERE t.id = $1 AND t.user_id = $2`,
    [id, req.userId]
  );
  res.json({ slot: toSlotDTO(result.rows[0]) });
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const pool = getPool();
  await pool.query("DELETE FROM timetable_slots WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
  res.json({ success: true });
}));

export default router;
