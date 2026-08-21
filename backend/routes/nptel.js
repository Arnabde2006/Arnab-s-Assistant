import express from "express";
import { getPool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { callGemini } from "../gemini.js";
import { safeParseJSON, toISO } from "../utils/dateHelpers.js";
import { calculateWeeklyDueDate } from "../utils/nptelDates.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();
router.use(requireAuth);

// Insert a batch of assignments for one course in a single round-trip. `rows` is
// an array of { week_number, title, due_date, submitted?, score? }. Returns the
// inserted rows (RETURNING *), sorted by week number so callers get a stable
// order regardless of the order Postgres returns them in.
async function insertAssignments(pool, userId, courseId, rows) {
  if (rows.length === 0) return [];
  const res = await pool.query(
    `INSERT INTO nptel_assignments (user_id, course_id, week_number, title, due_date, submitted, score)
     SELECT $1, $2, week_number, title, due_date, submitted, score
     FROM unnest($3::int[], $4::text[], $5::date[], $6::boolean[], $7::numeric[])
          AS t(week_number, title, due_date, submitted, score)
     RETURNING *`,
    [
      userId,
      courseId,
      rows.map((r) => r.week_number),
      rows.map((r) => r.title),
      rows.map((r) => r.due_date),
      rows.map((r) => r.submitted ?? false),
      rows.map((r) => r.score ?? null),
    ]
  );
  return res.rows.sort((a, b) => a.week_number - b.week_number);
}

// ─── GET /api/nptel ──────────────────────────────────────────────────────────
router.get("/", asyncHandler(async (req, res) => {
  const pool = getPool();

  const coursesRes = await pool.query(
    "SELECT * FROM nptel_courses WHERE user_id = $1 ORDER BY sort_order ASC, created_at DESC",
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

    let assignmentRows;
    if (Array.isArray(custom_assignments) && custom_assignments.length > 0) {
      assignmentRows = custom_assignments
        .filter((ca) => ca.week_number && ca.due_date)
        .map((ca) => {
          const prev = prevByWeek[ca.week_number];
          return {
            week_number: ca.week_number,
            title: ca.title || `Week ${ca.week_number} Assignment`,
            due_date: ca.due_date,
            submitted: prev?.submitted || false,
            score: prev?.score || null,
          };
        });
    } else {
      assignmentRows = [];
      for (let w = 1; w <= weeks; w++) {
        const prev = prevByWeek[w];
        assignmentRows.push({
          week_number: w,
          title: `Week ${w} Assignment`,
          due_date: calculateWeeklyDueDate(startDate, w, dueDay),
          submitted: prev?.submitted || false,
          score: prev?.score || null,
        });
      }
    }
    const insertedAssignments = await insertAssignments(pool, req.userId, courseId, assignmentRows);

    return res.status(200).json({ course: { ...updateRes.rows[0], assignments: insertedAssignments }, updated: true });
  }

  const courseRes = await pool.query(
    `INSERT INTO nptel_courses (user_id, course_name, duration_weeks, start_date, assignment_due_day, exam_date)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [req.userId, cleanName, weeks, startDate, dueDay, exam_date || null]
  );

  const course = courseRes.rows[0];

  let newRows;
  if (Array.isArray(custom_assignments) && custom_assignments.length > 0) {
    // Custom assignments array provided
    newRows = custom_assignments
      .filter((ca) => ca.week_number && ca.due_date)
      .map((ca) => ({
        week_number: ca.week_number,
        title: ca.title || `Week ${ca.week_number} Assignment`,
        due_date: ca.due_date,
      }));
  } else {
    // Auto-generate weekly assignment schedule
    newRows = [];
    for (let w = 1; w <= weeks; w++) {
      newRows.push({
        week_number: w,
        title: `Week ${w} Assignment`,
        due_date: calculateWeeklyDueDate(startDate, w, dueDay),
      });
    }
  }
  const insertedAssignments = await insertAssignments(pool, req.userId, course.id, newRows);

  res.status(201).json({ course: { ...course, assignments: insertedAssignments } });
}));

// ─── PUT /api/nptel/reorder ──────────────────────────────────────────────────
router.put("/reorder", asyncHandler(async (req, res) => {
  const { courseIds } = req.body;
  if (!Array.isArray(courseIds)) {
    return res.status(400).json({ error: "courseIds array is required" });
  }

  const pool = getPool();
  // One round-trip: map each id to its position via unnest WITH ORDINALITY.
  // Ordinality is 1-based, so subtract 1 to keep the original 0-based sort_order.
  await pool.query(
    `UPDATE nptel_courses AS c
       SET sort_order = ids.ord - 1
     FROM unnest($1::uuid[]) WITH ORDINALITY AS ids(id, ord)
     WHERE c.id = ids.id AND c.user_id = $2`,
    [courseIds, req.userId]
  );

  res.json({ success: true });
}));

// ─── PUT /api/nptel/assignments/:id ──────────────────────────────────────────
router.put("/assignments/:id", asyncHandler(async (req, res) => {
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

    const regenRows = [];
    for (let w = 1; w <= weeks; w++) {
      const wasSubmitted = submittedByWeek[w] !== undefined;
      regenRows.push({
        week_number: w,
        title: `Week ${w} Assignment`,
        due_date: calculateWeeklyDueDate(newStartDate, w, dueDay),
        submitted: wasSubmitted,
        score: wasSubmitted ? submittedByWeek[w] : null,
      });
    }
    await insertAssignments(pool, req.userId, courseId, regenRows);
  }

  res.json({ course: courseRes.rows[0] });
}));

// ─── DELETE /api/nptel/:id ───────────────────────────────────────────────────
router.delete("/:id", asyncHandler(async (req, res) => {
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
