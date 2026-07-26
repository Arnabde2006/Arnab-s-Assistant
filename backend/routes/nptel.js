import express from "express";
import { getPool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { callGemini } from "../gemini.js";
import { safeParseJSON, toISO } from "../utils/dateHelpers.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();
router.use(requireAuth);

let tableEnsured = false;
async function ensureTables() {
  if (tableEnsured) return;
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS nptel_courses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_name TEXT NOT NULL,
      duration_weeks INTEGER NOT NULL DEFAULT 8,
      start_date DATE NOT NULL DEFAULT CURRENT_DATE,
      assignment_due_day INTEGER NOT NULL DEFAULT 3,
      exam_date DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS nptel_assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id UUID NOT NULL REFERENCES nptel_courses(id) ON DELETE CASCADE,
      week_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      due_date DATE NOT NULL,
      submitted BOOLEAN NOT NULL DEFAULT false,
      score NUMERIC,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_nptel_courses_user ON nptel_courses(user_id);
    CREATE INDEX IF NOT EXISTS idx_nptel_assignments_course ON nptel_assignments(course_id, due_date);
  `);
  tableEnsured = true;
}

// Utility function to calculate weekly assignment dates
function calculateWeeklyDueDate(startDateStr, weekNum, targetDayOfWeek = 3) {
  const start = new Date(startDateStr + "T00:00:00");
  // Calculate date roughly weekNum weeks after start
  const baseDate = new Date(start);
  baseDate.setDate(baseDate.getDate() + (weekNum * 7));

  // Adjust to nearest targetDayOfWeek (e.g. Wednesday = 3)
  const currentDay = baseDate.getDay();
  let diff = targetDayOfWeek - currentDay;
  baseDate.setDate(baseDate.getDate() + diff);

  return toISO(baseDate);
}

// ─── GET /api/nptel ──────────────────────────────────────────────────────────
router.get("/", asyncHandler(async (req, res) => {
  await ensureTables();
  const pool = getPool();

  const coursesRes = await pool.query(
    "SELECT * FROM nptel_courses WHERE user_id = $1 ORDER BY created_at DESC",
    [req.userId]
  );

  const assignmentsRes = await pool.query(
    `SELECT a.*, c.course_name
     FROM nptel_assignments a
     JOIN nptel_courses c ON a.course_id = c.id
     WHERE a.user_id = $1
     ORDER BY a.due_date ASC`,
    [req.userId]
  );

  const courses = coursesRes.rows.map((c) => {
    const courseAssignments = assignmentsRes.rows.filter((a) => a.course_id === c.id);
    const submittedCount = courseAssignments.filter((a) => a.submitted).length;
    return {
      ...c,
      assignments: courseAssignments,
      progress: courseAssignments.length ? Math.round((submittedCount / courseAssignments.length) * 100) : 0,
      submittedCount,
      totalAssignments: courseAssignments.length,
    };
  });

  res.json({ courses, allAssignments: assignmentsRes.rows });
}));

// ─── POST /api/nptel ─────────────────────────────────────────────────────────
router.post("/", asyncHandler(async (req, res) => {
  await ensureTables();
  const { course_name, duration_weeks, start_date, assignment_due_day, exam_date, custom_assignments } = req.body;

  if (!course_name) {
    return res.status(400).json({ error: "Course name is required" });
  }

  const pool = getPool();
  const weeks = duration_weeks ? Math.min(Math.max(Number(duration_weeks), 1), 16) : 8;
  const dueDay = assignment_due_day !== undefined ? Number(assignment_due_day) : 3; // Wednesday default
  const startDate = start_date || toISO(new Date());

  const courseRes = await pool.query(
    `INSERT INTO nptel_courses (user_id, course_name, duration_weeks, start_date, assignment_due_day, exam_date)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [req.userId, course_name.trim(), weeks, startDate, dueDay, exam_date || null]
  );

  const course = courseRes.rows[0];
  const insertedAssignments = [];

  if (Array.isArray(custom_assignments) && custom_assignments.length > 0) {
    // Custom assignments array provided
    for (const ca of custom_assignments) {
      if (!ca.week_number || !ca.due_date) continue;
      const aRes = await pool.query(
        `INSERT INTO nptel_assignments (user_id, course_id, week_number, title, due_date)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [req.userId, course.id, ca.week_number, ca.title || `Week ${ca.week_number} Assignment`, ca.due_date]
      );
      insertedAssignments.push(aRes.rows[0]);
    }
  } else {
    // Auto-generate weekly assignment schedule
    for (let w = 1; w <= weeks; w++) {
      const dueDate = calculateWeeklyDueDate(startDate, w, dueDay);
      const aRes = await pool.query(
        `INSERT INTO nptel_assignments (user_id, course_id, week_number, title, due_date)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [req.userId, course.id, w, `Week ${w} Assignment`, dueDate]
      );
      insertedAssignments.push(aRes.rows[0]);
    }
  }

  res.status(201).json({ course: { ...course, assignments: insertedAssignments } });
}));

// ─── PUT /api/nptel/assignments/:id ──────────────────────────────────────────
router.put("/assignments/:id", asyncHandler(async (req, res) => {
  await ensureTables();
  const { submitted, score } = req.body;

  const pool = getPool();
  const result = await pool.query(
    `UPDATE nptel_assignments SET
       submitted = COALESCE($1, submitted),
       score = COALESCE($2, score)
     WHERE id = $3 AND user_id = $4
     RETURNING *`,
    [submitted ?? null, score !== undefined && score !== null ? Number(score) : null, req.params.id, req.userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Assignment not found" });
  }

  res.json({ assignment: result.rows[0] });
}));

// ─── DELETE /api/nptel/:id ───────────────────────────────────────────────────
router.delete("/:id", asyncHandler(async (req, res) => {
  await ensureTables();
  const pool = getPool();
  await pool.query("DELETE FROM nptel_courses WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
  res.json({ success: true });
}));

// ─── POST /api/nptel/parse-schedule ─────────────────────────────────────────
router.post("/parse-schedule", asyncHandler(async (req, res) => {
  const { fileBase64, mimeType } = req.body;
  if (!fileBase64 || !mimeType) {
    return res.status(400).json({ error: "fileBase64 and mimeType are required" });
  }

  const todayStr = toISO(new Date());

  const systemInstruction = `You extract NPTEL course schedules or assignment announcements from a screenshot or PDF.
Today's date is ${todayStr}.

Extract details and return ONLY a JSON object:
{
  "course_name": "string (e.g. Programming in Java)",
  "duration_weeks": number (4, 8, or 12),
  "start_date": "YYYY-MM-DD",
  "exam_date": "YYYY-MM-DD or null",
  "assignments": [
    { "week_number": 1, "title": "Week 1 Assignment", "due_date": "YYYY-MM-DD" }
  ]
}

If specific weekly assignment due dates aren't individually listed, generate ${8} weekly due dates starting from start_date (with Wednesdays as default due dates).`;

  const text = await callGemini({
    systemInstruction,
    parts: [
      { inline_data: { mime_type: mimeType, data: fileBase64 } },
      { text: "Extract NPTEL course schedule details." },
    ],
    jsonMode: true,
  });

  let parsed;
  try {
    parsed = safeParseJSON(text);
  } catch {
    return res.status(502).json({ error: "Couldn't read NPTEL schedule from the image clearly." });
  }

  res.json({ extracted: parsed });
}));

export default router;
