import express from "express";
import { getPool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { callGemini } from "../gemini.js";
import { toISO, safeParseJSON } from "../utils/dateHelpers.js";
import { asyncHandler } from "../utils/asyncHandler.js";

import { computeFinanceSummary } from "../lib/financeSummary.js";

const router = express.Router();
router.use(requireAuth);

// ---- AI Action Execution Engine -----------------------------------------------

async function processAiChatAction(userId, message) {
  const pool = getPool();
  const todayStr = toISO(new Date());

  const systemInstruction = `You are the intent and action parser for a personal college companion app.
Today's date is: ${todayStr}.
Analyze the student's input. If they are requesting an action to create, update, or delete a calendar item, task, exam, subscription, or attendance log, extract the action parameters into JSON.

Supported actions:
1. Add To-do / Calendar Event:
   Input example: "Mark 3rd of Aug in calendar as College opening day" or "Remind me to submit assignment tomorrow"
   JSON: {"action": "add_todo", "text": "College opening day", "date": "YYYY-MM-DD", "priority": "normal"|"urgent"}

2. Mark To-do as Completed or Delete:
   Input example: "Mark College opening day as done" or "Delete assignment task"
   JSON: {"action": "mark_todo_done", "text": "College opening day"} or {"action": "delete_todo", "text": "College opening day"}

3. Add Subscription / Free Trial:
   Input example: "Add Crunchyroll free trial ending Aug 26"
   JSON: {"action": "add_subscription", "name": "Crunchyroll", "amount": 99, "currency": "₹", "billing_cycle": "monthly", "plan_type": "free_trial"|"paid", "renewal_date": "YYYY-MM-DD"}

4. Add Exam:
   Input example: "Add Python exam on Aug 10"
   JSON: {"action": "add_exam", "course": "Python", "date": "YYYY-MM-DD", "time": "string"}

5. Mark Attendance Log:
   Input example: "Mark me present for today"
   JSON: {"action": "mark_attendance", "date": "YYYY-MM-DD", "status": "present"|"absent"|"half_day"}

6. Mark NPTEL Assignment:
   Input example: "Mark Python week 1 assignment as completed"
   JSON: {"action": "mark_nptel", "week_number": 1, "submitted": true}

If the user message is general conversation or an informational question, return:
{"action": "none"}

Return ONLY valid JSON.`;

  try {
    const rawJson = await callGemini({
      systemInstruction,
      parts: [{ text: message }],
      jsonMode: true,
    });

    const parsed = safeParseJSON(rawJson);
    if (!parsed || !parsed.action || parsed.action === "none") return null;

    if (parsed.action === "add_todo" && parsed.text && parsed.date) {
      const res = await pool.query(
        "INSERT INTO todos (user_id, text, date, priority, source) VALUES ($1, $2, $3, $4, 'ai') RETURNING *",
        [userId, parsed.text, parsed.date, parsed.priority || "normal"]
      );
      return { success: true, type: "todo", item: res.rows[0], message: `Successfully saved "${parsed.text}" on ${parsed.date} directly into the database & calendar!` };
    }

    if (parsed.action === "mark_todo_done" && parsed.text) {
      await pool.query(
        "UPDATE todos SET done = true WHERE user_id = $1 AND LOWER(text) LIKE $2",
        [userId, `%${parsed.text.toLowerCase()}%`]
      );
      return { success: true, type: "todo_done", message: `Marked task containing "${parsed.text}" as completed in the database.` };
    }

    if (parsed.action === "delete_todo" && parsed.text) {
      await pool.query(
        "DELETE FROM todos WHERE user_id = $1 AND LOWER(text) LIKE $2",
        [userId, `%${parsed.text.toLowerCase()}%`]
      );
      return { success: true, type: "todo_delete", message: `Deleted task containing "${parsed.text}" from the database.` };
    }

    if (parsed.action === "add_subscription" && parsed.name && parsed.renewal_date) {
      const res = await pool.query(
        `INSERT INTO subscriptions (user_id, name, plan_type, amount, currency, billing_cycle, start_date, renewal_date, remind_days_before, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 3, 'active', 'Added via AI Assistant') RETURNING *`,
        [userId, parsed.name, parsed.plan_type || "paid", parsed.amount || 0, parsed.currency || "₹", parsed.billing_cycle || "monthly", todayStr, parsed.renewal_date]
      );
      return { success: true, type: "subscription", item: res.rows[0], message: `Successfully added subscription "${parsed.name}" renewing on ${parsed.renewal_date} to database.` };
    }

    if (parsed.action === "add_exam" && parsed.course && parsed.date) {
      const res = await pool.query(
        "INSERT INTO exams (user_id, course, exam_date, exam_time) VALUES ($1, $2, $3, $4) RETURNING *",
        [userId, parsed.course, parsed.date, parsed.time || ""]
      );
      await pool.query(
        "INSERT INTO todos (user_id, text, date, priority, source) VALUES ($1, $2, $3, 'urgent', 'exam')",
        [userId, `Exam: ${parsed.course}`, parsed.date]
      );
      return { success: true, type: "exam", item: res.rows[0], message: `Successfully added exam "${parsed.course}" on ${parsed.date} to calendar.` };
    }

    if (parsed.action === "mark_attendance" && parsed.date && parsed.status) {
      await pool.query(
        "INSERT INTO day_attendance (user_id, date, status) VALUES ($1, $2, $3) ON CONFLICT (user_id, date) DO UPDATE SET status = EXCLUDED.status",
        [userId, parsed.date, parsed.status]
      );
      return { success: true, type: "attendance", message: `Marked attendance as ${parsed.status} for ${parsed.date}.` };
    }

    if (parsed.action === "mark_nptel" && parsed.week_number) {
      await pool.query(
        "UPDATE nptel_assignments SET submitted = $1 WHERE user_id = $2 AND week_number = $3",
        [parsed.submitted ?? true, userId, parsed.week_number]
      );
      return { success: true, type: "nptel", message: `Updated NPTEL Week ${parsed.week_number} assignment submission.` };
    }
  } catch (err) {
    console.error("[AI Action Execution Error]:", err);
  }
  return null;
}

// ---- Chat assistant (SSE streaming) ----------------------------------------

router.post("/chat", async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ error: "message is required" });

    const pool = getPool();
    const today = toISO(new Date());

    // Execute any requested database action first (e.g. adding calendar event / todo / subscription)
    const actionResult = await processAiChatAction(req.userId, message);

    const [attendanceRes, todosRes, examsRes, gradesSummary, financeSummary, subsRes, nptelRes] = await Promise.all([
      pool.query("SELECT status FROM day_attendance WHERE user_id = $1", [req.userId]),
      pool.query("SELECT text, date, done FROM todos WHERE user_id = $1 AND date >= $2 ORDER BY date ASC LIMIT 20", [req.userId, today]),
      pool.query("SELECT course, exam_date FROM exams WHERE user_id = $1 AND exam_date >= $2 ORDER BY exam_date ASC LIMIT 10", [req.userId, today]),
      computeGrades(req.userId),
      computeFinanceSummary(req.userId).catch(() => null),
      pool.query("SELECT name, plan_type, amount, currency, renewal_date, (renewal_date - CURRENT_DATE) as days_left FROM subscriptions WHERE user_id = $1 AND status = 'active' ORDER BY renewal_date ASC", [req.userId]).catch(() => ({ rows: [] })),
      pool.query(`SELECT a.title, a.due_date, a.submitted, c.course_name FROM nptel_assignments a JOIN nptel_courses c ON a.course_id = c.id WHERE a.user_id = $1 AND a.due_date >= $2 AND a.submitted = false ORDER BY a.due_date ASC LIMIT 10`, [req.userId, today]).catch(() => ({ rows: [] })),
    ]);

    const records = attendanceRes.rows;
    const total = records.length;
    const present = records.filter((r) => r.status === "present").length;
    const halfDay = records.filter((r) => r.status === "half_day").length;
    const pct = total ? Math.round(((present + halfDay * 0.5) / total) * 1000) / 10 : null;

    const subsList = subsRes.rows || [];
    const nptelList = nptelRes.rows || [];

    const contextLines = [
      `Today's date: ${today}.`,
      actionResult ? `SYSTEM NOTIFICATION FOR ASSISTANT: ${actionResult.message}` : "",
      pct !== null
        ? `The student's overall attendance is ${pct}% (${present} present, ${halfDay} half days, ${total} total days logged).`
        : "No attendance has been logged yet.",
      todosRes.rows.length
        ? `Upcoming to-dos: ${todosRes.rows.map((t) => `"${t.text}" on ${t.date}${t.done ? " (done)" : ""}`).join("; ")}.`
        : "No upcoming to-dos.",
      nptelList.length
        ? `Pending NPTEL Assignments: ${nptelList.map((a) => `${a.course_name} (${a.title}) due ${a.due_date}`).join("; ")}.`
        : "No pending NPTEL assignments.",
      examsRes.rows.length
        ? `Upcoming exams: ${examsRes.rows.map((e) => `${e.course} on ${e.exam_date}`).join("; ")}.`
        : "No upcoming exams recorded.",
      gradesSummary.semesters.length
        ? `Grade history: CGPA is ${gradesSummary.cgpa} (${gradesSummary.totalCredits} total credits). Semester breakdown: ${gradesSummary.semesters.map((s) => `Semester ${s.semester} (SGPA ${s.sgpa}): ${s.courses.map((c) => `${c.course} (${c.grade})`).join(", ")}`).join("; ")}.`
        : "No grades have been added to the grade tracker yet.",
      financeSummary
        ? `Finance summary: Spent ₹${financeSummary.expense} this month, income ₹${financeSummary.income} this month.`
        : "No finance data logged.",
      subsList.length
        ? `Active Subscriptions & Free Trials: ${subsList.map((s) => `${s.name} (${s.plan_type === 'free_trial' ? 'Free Trial' : 'Paid'}, ${s.currency}${s.amount}, renewal ${s.renewal_date}, ${s.days_left} days left)`).join("; ")}.`
        : "No active subscriptions tracked.",
    ].filter(Boolean).join(" ");

    const systemInstruction = `You are the built-in personal assistant for "Arnab's Assistant", a comprehensive personal & college companion app (attendance tracker, to-do & calendar, timetable, subscription & trial reminders, exam schedule, focus timer, grade tracker, finance tracker). Answer the student helpfully and concisely, using the context below when relevant. If asked something outside the app's scope, still answer normally as a helpful general assistant. Keep answers short and conversational, plain text, no markdown headers.

Context: ${contextLines}`;

    const parts = [];
    if (Array.isArray(history)) {
      for (const h of history.slice(-6)) {
        parts.push({ text: `${h.role === "user" ? "Student" : "Assistant"}: ${h.text}` });
      }
    }
    parts.push({ text: `Student: ${message}` });

    // ── SSE setup ──────────────────────────────────────────────────────────
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    let fullReply = "";

    await callGemini({
      systemInstruction,
      parts,
      onChunk: (chunk) => {
        fullReply += chunk;
        // Send each chunk as an SSE "delta" event
        res.write(`data: ${JSON.stringify({ delta: chunk })}\n\n`);
      },
    });

    // Signal end
    res.write(`data: ${JSON.stringify({ done: true, reply: fullReply.trim() })}\n\n`);
    res.end();
  } catch (err) {
    console.error(err);
    // If headers already sent (streaming started) send error over SSE
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: err.message || "Chat failed" })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: err.message || "Chat failed" });
    }
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