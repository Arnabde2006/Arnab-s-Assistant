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
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    ALTER TABLE nptel_courses ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

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
// NPTEL Week 1 assignment is due 2 weeks after start date (e.g. Aug 5 for July 20 start)
function calculateWeeklyDueDate(startDateStr, weekNum, targetDayOfWeek = 3) {
  const start = new Date(startDateStr + "T00:00:00");
  const baseDate = new Date(start);
  baseDate.setDate(baseDate.getDate() + ((weekNum + 1) * 7));

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
    "SELECT * FROM nptel_courses WHERE user_id = $1 ORDER BY sort_order ASC, created_at DESC",
    [req.userId]
  );

  // Auto-correct assignment due dates for existing courses if calculated with old offset
  for (const c of coursesRes.rows) {
    const startDateStr = toISO(new Date(c.start_date));
    const w1Res = await pool.query(
      "SELECT due_date FROM nptel_assignments WHERE course_id = $1 AND week_number = 1",
      [c.id]
    );
    if (w1Res.rows.length > 0 && w1Res.rows[0].due_date) {
      const w1Due = new Date(w1Res.rows[0].due_date);
      const startD = new Date(startDateStr + "T00:00:00");
      const diffDays = Math.round((w1Due - startD) / (1000 * 60 * 60 * 24));
      if (diffDays < 12) {
        for (let w = 1; w <= c.duration_weeks; w++) {
          const newDueDate = calculateWeeklyDueDate(startDateStr, w, c.assignment_due_day);
          await pool.query(
            "UPDATE nptel_assignments SET due_date = $1 WHERE course_id = $2 AND week_number = $3",
            [newDueDate, c.id, w]
          );
        }
      }
    }
  }

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
  const cleanName = course_name.trim();

  // Prevent duplicates: check if a course with the same name exists for this user
  const existing = await pool.query(
    "SELECT * FROM nptel_courses WHERE user_id = $1 AND LOWER(course_name) = LOWER($2)",
    [req.userId, cleanName]
  );

  if (existing.rows.length > 0) {
    const courseId = existing.rows[0].id;

    // Update the existing course
    const updateRes = await pool.query(
      `UPDATE nptel_courses
       SET course_name = $1, duration_weeks = $2, start_date = $3, assignment_due_day = $4, exam_date = $5
       WHERE id = $6 AND user_id = $7
       RETURNING *`,
      [cleanName, weeks, startDate, dueDay, exam_date || null, courseId, req.userId]
    );

    // Preserve existing assignment submitted statuses and scores
    const prevAssignments = await pool.query(
      "SELECT week_number, submitted, score FROM nptel_assignments WHERE course_id = $1",
      [courseId]
    );
    const prevByWeek = {};
    for (const row of prevAssignments.rows) {
      prevByWeek[row.week_number] = row;
    }

    await pool.query("DELETE FROM nptel_assignments WHERE course_id = $1", [courseId]);

    const insertedAssignments = [];
    if (Array.isArray(custom_assignments) && custom_assignments.length > 0) {
      for (const ca of custom_assignments) {
        if (!ca.week_number || !ca.due_date) continue;
        const prev = prevByWeek[ca.week_number];
        const aRes = await pool.query(
          `INSERT INTO nptel_assignments (user_id, course_id, week_number, title, due_date, submitted, score)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [
            req.userId,
            courseId,
            ca.week_number,
            ca.title || `Week ${ca.week_number} Assignment`,
            ca.due_date,
            prev?.submitted || false,
            prev?.score || null,
          ]
        );
        insertedAssignments.push(aRes.rows[0]);
      }
    } else {
      for (let w = 1; w <= weeks; w++) {
        const dueDate = calculateWeeklyDueDate(startDate, w, dueDay);
        const prev = prevByWeek[w];
        const aRes = await pool.query(
          `INSERT INTO nptel_assignments (user_id, course_id, week_number, title, due_date, submitted, score)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [
            req.userId,
            courseId,
            w,
            `Week ${w} Assignment`,
            dueDate,
            prev?.submitted || false,
            prev?.score || null,
          ]
        );
        insertedAssignments.push(aRes.rows[0]);
      }
    }

    return res.status(200).json({ course: { ...updateRes.rows[0], assignments: insertedAssignments }, updated: true });
  }

  const courseRes = await pool.query(
    `INSERT INTO nptel_courses (user_id, course_name, duration_weeks, start_date, assignment_due_day, exam_date)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [req.userId, cleanName, weeks, startDate, dueDay, exam_date || null]
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

// ─── PUT /api/nptel/reorder ──────────────────────────────────────────────────
router.put("/reorder", asyncHandler(async (req, res) => {
  await ensureTables();
  const { courseIds } = req.body;
  if (!Array.isArray(courseIds)) {
    return res.status(400).json({ error: "courseIds array is required" });
  }

  const pool = getPool();
  for (let i = 0; i < courseIds.length; i++) {
    await pool.query(
      "UPDATE nptel_courses SET sort_order = $1 WHERE id = $2 AND user_id = $3",
      [i, courseIds[i], req.userId]
    );
  }

  res.json({ success: true });
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

// ─── PUT /api/nptel/:id ─────────────────────────────────────────────────────
router.put("/:id", asyncHandler(async (req, res) => {
  await ensureTables();
  const { course_name, duration_weeks, start_date, assignment_due_day, exam_date } = req.body;
  const pool = getPool();
  const courseId = req.params.id;

  const existing = await pool.query(
    "SELECT * FROM nptel_courses WHERE id = $1 AND user_id = $2",
    [courseId, req.userId]
  );
  if (existing.rows.length === 0) {
    return res.status(404).json({ error: "Course not found" });
  }
  const old = existing.rows[0];

  const weeks = duration_weeks ? Math.min(Math.max(Number(duration_weeks), 1), 16) : old.duration_weeks;
  const dueDay = assignment_due_day !== undefined ? Number(assignment_due_day) : old.assignment_due_day;
  const newStartDate = start_date || toISO(new Date(old.start_date));
  const oldStartDate = toISO(new Date(old.start_date));

  const courseRes = await pool.query(
    `UPDATE nptel_courses
     SET course_name = $1, duration_weeks = $2, start_date = $3, assignment_due_day = $4, exam_date = $5
     WHERE id = $6 AND user_id = $7
     RETURNING *`,
    [
      course_name?.trim() || old.course_name,
      weeks,
      newStartDate,
      dueDay,
      exam_date !== undefined ? (exam_date || null) : old.exam_date,
      courseId,
      req.userId,
    ]
  );

  // Regenerate assignment dates if scheduling params changed
  const needsRegenerate =
    newStartDate !== oldStartDate ||
    weeks !== old.duration_weeks ||
    dueDay !== old.assignment_due_day;

  if (needsRegenerate) {
    // Preserve submitted weeks
    const submittedRes = await pool.query(
      "SELECT week_number, score FROM nptel_assignments WHERE course_id = $1 AND submitted = true",
      [courseId]
    );
    const submittedByWeek = {};
    for (const row of submittedRes.rows) {
      submittedByWeek[row.week_number] = row.score;
    }

    await pool.query("DELETE FROM nptel_assignments WHERE course_id = $1", [courseId]);

    for (let w = 1; w <= weeks; w++) {
      const dueDate = calculateWeeklyDueDate(newStartDate, w, dueDay);
      const wasSubmitted = submittedByWeek[w] !== undefined;
      await pool.query(
        `INSERT INTO nptel_assignments (user_id, course_id, week_number, title, due_date, submitted, score)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [req.userId, courseId, w, `Week ${w} Assignment`, dueDate, wasSubmitted, wasSubmitted ? submittedByWeek[w] : null]
      );
    }
  }

  res.json({ course: courseRes.rows[0] });
}));

// ─── DELETE /api/nptel/:id ───────────────────────────────────────────────────
router.delete("/:id", asyncHandler(async (req, res) => {
  await ensureTables();
  const pool = getPool();
  await pool.query("DELETE FROM nptel_courses WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
  res.json({ success: true });
}));

// ─── POST /api/nptel/lookup-course ─────────────────────────────────────────
router.post("/lookup-course", asyncHandler(async (req, res) => {
  const { courseName } = req.body;
  if (!courseName || !courseName.trim()) {
    return res.status(400).json({ error: "courseName is required" });
  }

  const todayStr = toISO(new Date());

  const systemInstruction = `You are an NPTEL course assistant with knowledge of all NPTEL courses offered on nptel.ac.in.
Today's date is ${todayStr}. NPTEL runs two semesters: Jan–Apr (starts ~Jan 20) and Jul–Nov (starts ~Jul 21).
Based on the current date, infer the most likely active or upcoming semester's start date.

Given a course name, return details about the NPTEL course.
If you recognise the course, use actual known details. Otherwise make reasonable estimates.
Duration defaults to 12 weeks if unknown. Exam is typically 3–4 weeks after the last assignment week.

Return ONLY a JSON object:
{
  "course_name": "exact/corrected full NPTEL course name",
  "duration_weeks": 4 or 8 or 12,
  "start_date": "YYYY-MM-DD",
  "exam_date": "YYYY-MM-DD or null",
  "description": "one-sentence description of the course"
}`;

  let text;
  try {
    text = await callGemini({
      systemInstruction,
      parts: [{ text: `Look up NPTEL course: "${courseName.trim()}"` }],
      jsonMode: true,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || "AI lookup failed. Please try again." });
  }

  let parsed;
  try {
    parsed = safeParseJSON(text);
  } catch {
    return res.status(502).json({ error: "AI couldn't look up this course. Please fill in details manually." });
  }

  res.json({ course: parsed });
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

If specific weekly assignment due dates aren't individually listed, generate 8 weekly due dates starting from start_date (with Wednesdays as default due dates).`;

  let text;
  try {
    text = await callGemini({
      systemInstruction,
      parts: [
        { inline_data: { mime_type: mimeType, data: fileBase64 } },
        { text: "Extract NPTEL course schedule details." },
      ],
      jsonMode: true,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Failed to process image with AI." });
  }

  let parsed;
  try {
    parsed = safeParseJSON(text);
  } catch {
    return res.status(502).json({ error: "Couldn't read NPTEL schedule from the image clearly." });
  }

  res.json({ extracted: parsed });
}));

export default router;
