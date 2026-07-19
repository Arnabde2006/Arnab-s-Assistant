import express from "express";
import { getPool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { callGemini } from "../gemini.js";
import { toISO, safeParseJSON } from "../utils/dateHelpers.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();
router.use(requireAuth);

// ---- Chat assistant -------------------------------------------------

router.post("/chat", async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ error: "message is required" });

    const pool = getPool();
    const today = toISO(new Date());

    const [attendanceRes, todosRes, examsRes] = await Promise.all([
      pool.query("SELECT status FROM day_attendance WHERE user_id = $1", [req.userId]),
      pool.query("SELECT text, date, done FROM todos WHERE user_id = $1 AND date >= $2 ORDER BY date ASC LIMIT 20", [req.userId, today]),
      pool.query("SELECT course, exam_date FROM exams WHERE user_id = $1 AND exam_date >= $2 ORDER BY exam_date ASC LIMIT 10", [req.userId, today]),
    ]);

    const records = attendanceRes.rows;
    const total = records.length;
    const present = records.filter((r) => r.status === "present").length;
    const halfDay = records.filter((r) => r.status === "half_day").length;
    const pct = total ? Math.round(((present + halfDay * 0.5) / total) * 1000) / 10 : null;

    const contextLines = [
      `Today's date: ${today}.`,
      pct !== null ? `The student's overall attendance is ${pct}% (${present} present, ${halfDay} half days, ${total} total days logged).` : "No attendance has been logged yet.",
      todosRes.rows.length
        ? `Upcoming to-dos: ${todosRes.rows.map((t) => `"${t.text}" on ${t.date}${t.done ? " (done)" : ""}`).join("; ")}.`
        : "No upcoming to-dos.",
      examsRes.rows.length
        ? `Upcoming exams: ${examsRes.rows.map((e) => `${e.course} on ${e.exam_date}`).join("; ")}.`
        : "No upcoming exams recorded.",
    ].join(" ");

    const systemInstruction = `You are the built-in assistant for "Arnab's Assistant", a personal college companion app (attendance tracker, to-do/calendar, timetable, exam schedule, focus timer, grade tracker). Answer the student's question helpfully and concisely, using the context below when relevant. If asked something outside the app's scope, still answer normally as a helpful general assistant. Keep answers short and conversational, plain text, no markdown headers.

Context: ${contextLines}`;

    const parts = [];
    if (Array.isArray(history)) {
      for (const h of history.slice(-6)) {
        parts.push({ text: `${h.role === "user" ? "Student" : "Assistant"}: ${h.text}` });
      }
    }
    parts.push({ text: `Student: ${message}` });

    const reply = await callGemini({ systemInstruction, parts });
    res.json({ reply: reply.trim() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Chat failed" });
  }
});

// ---- Exam timetable upload -> auto-add to calendar -------------------

router.post("/exam-timetable", async (req, res) => {
  try {
    const { fileBase64, mimeType, courses } = req.body;
    if (!fileBase64 || !mimeType) {
      return res.status(400).json({ error: "fileBase64 and mimeType are required" });
    }

    const courseHint = courses && courses.trim()
      ? `The student says they are taking these courses: ${courses}. Only include exams for these courses (match loosely, e.g. abbreviations or partial names count).`
      : "Include every exam you can find on the timetable.";

    const systemInstruction = `You extract exam schedules from a photo or PDF of a college exam timetable. ${courseHint}
Return ONLY a JSON array, no prose, in this exact shape:
[{"course": "string", "date": "YYYY-MM-DD", "time": "string, e.g. 10:00 AM or empty string if not shown", "notes": "string, e.g. room number, empty string if none"}]
Infer the year from context if the timetable only shows day/month; assume the nearest upcoming occurrence. If you cannot find any exams, return [].`;

    const text = await callGemini({
      systemInstruction,
      parts: [{ inline_data: { mime_type: mimeType, data: fileBase64 } }, { text: "Extract the exam schedule." }],
      jsonMode: true,
    });

    let exams;
    try {
      exams = safeParseJSON(text);
    } catch {
      return res.status(502).json({ error: "Couldn't read the timetable clearly. Try a clearer photo or PDF." });
    }
    if (!Array.isArray(exams)) exams = [];

    const pool = getPool();
    const inserted = [];
    for (const e of exams) {
      if (!e.course || !e.date) continue;
      const examResult = await pool.query(
        `INSERT INTO exams (user_id, course, exam_date, exam_time, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [req.userId, e.course, e.date, e.time || "", e.notes || ""]
      );
      inserted.push(examResult.rows[0]);

      await pool.query(
        `INSERT INTO todos (user_id, text, date, priority, source) VALUES ($1, $2, $3, 'urgent', 'exam')`,
        [req.userId, `Exam: ${e.course}${e.time ? ` (${e.time})` : ""}`, e.date]
      );
    }

    res.json({ exams: inserted, count: inserted.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to process the timetable" });
  }
});

router.get("/exams", asyncHandler(async (req, res) => {
  const pool = getPool();
  const result = await pool.query("SELECT * FROM exams WHERE user_id = $1 ORDER BY exam_date ASC", [req.userId]);
  res.json({ exams: result.rows });
}));

router.delete("/exams/:id", asyncHandler(async (req, res) => {
  const pool = getPool();
  await pool.query("DELETE FROM exams WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
  res.json({ success: true });
}));

// ---- Grade card upload -> parse + compute SGPA/CGPA -------------------

router.post("/grade-card", asyncHandler(async (req, res) => {
  const { fileBase64, mimeType, semester } = req.body;
  if (!fileBase64 || !mimeType || !semester) {
    return res.status(400).json({ error: "fileBase64, mimeType and semester are required" });
  }

  const systemInstruction = `You extract results from a photo or PDF of a college semester grade card / marksheet.
Return ONLY a JSON array, no prose, in this exact shape:
[{"course": "string", "credits": number, "grade": "string, e.g. A+", "gradePoints": number}]
If the document already shows grade points or credit points per course, use those exact numbers. If it only shows letter grades, map them using this standard 10-point scale: O=10, A+=9, A=8, B+=7, B=6, C=5, P=4, F=0. If credits aren't shown anywhere, use 4 as a default. Skip header/summary rows, only include actual course rows.`;

  const text = await callGemini({
    systemInstruction,
    parts: [{ inline_data: { mime_type: mimeType, data: fileBase64 } }, { text: "Extract the grade card." }],
    jsonMode: true,
  });

  let entries;
  try {
    entries = safeParseJSON(text);
  } catch {
    return res.status(502).json({ error: "Couldn't read the grade card clearly. Try a clearer photo or PDF. Your existing data hasn't been changed." });
  }
  if (!Array.isArray(entries)) entries = [];

  const validEntries = entries.filter((e) => e.course && e.credits !== undefined && e.gradePoints !== undefined);

  // Never touch existing data unless we actually have something valid to
  // replace it with — otherwise a misread upload would silently wipe a
  // semester's grades with nothing to show for it.
  if (validEntries.length === 0) {
    return res.status(502).json({ error: "Couldn't find any valid grade rows in that file. Your existing data hasn't been changed — try a clearer photo or PDF." });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM grade_entries WHERE user_id = $1 AND semester = $2", [req.userId, semester]);
    for (const e of validEntries) {
      await client.query(
        `INSERT INTO grade_entries (user_id, semester, course, credits, grade, grade_points)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.userId, semester, e.course, e.credits, e.grade || "", e.gradePoints]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const summary = await computeGrades(req.userId);
  res.json(summary);
}));

router.get("/grades", asyncHandler(async (req, res) => {
  const summary = await computeGrades(req.userId);
  res.json(summary);
}));

router.delete("/grades/:semester", asyncHandler(async (req, res) => {
  const pool = getPool();
  await pool.query("DELETE FROM grade_entries WHERE user_id = $1 AND semester = $2", [req.userId, req.params.semester]);
  const summary = await computeGrades(req.userId);
  res.json(summary);
}));

async function computeGrades(userId) {
  const pool = getPool();
  const result = await pool.query(
    "SELECT * FROM grade_entries WHERE user_id = $1 ORDER BY semester ASC, created_at ASC",
    [userId]
  );
  const entries = result.rows;

  const bySemester = {};
  for (const e of entries) {
    if (!bySemester[e.semester]) bySemester[e.semester] = [];
    bySemester[e.semester].push(e);
  }

  const semesters = Object.keys(bySemester).map((sem) => {
    const rows = bySemester[sem];
    const totalCredits = rows.reduce((sum, r) => sum + Number(r.credits), 0);
    const weighted = rows.reduce((sum, r) => sum + Number(r.credits) * Number(r.grade_points), 0);
    const sgpa = totalCredits ? Math.round((weighted / totalCredits) * 100) / 100 : 0;
    return { semester: sem, sgpa, totalCredits, courses: rows };
  });

  const totalCreditsAll = entries.reduce((sum, r) => sum + Number(r.credits), 0);
  const weightedAll = entries.reduce((sum, r) => sum + Number(r.credits) * Number(r.grade_points), 0);
  const cgpa = totalCreditsAll ? Math.round((weightedAll / totalCreditsAll) * 100) / 100 : 0;

  return { semesters, cgpa, totalCredits: totalCreditsAll };
}

export default router;