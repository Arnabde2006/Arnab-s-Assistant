import express from "express";
import { getPool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { callGemini } from "../gemini.js";
import { safeParseJSON } from "../utils/dateHelpers.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();
router.use(requireAuth);

// Mark a single date as "college off". A date can only be either a holiday
// or a day_attendance entry, never both — marking a holiday clears any
// attendance record for that date so the two never conflict.
router.post("/", asyncHandler(async (req, res) => {
  const { date, reason } = req.body;
  if (!date) return res.status(400).json({ error: "date is required" });

  const pool = getPool();
  await pool.query("DELETE FROM day_attendance WHERE user_id = $1 AND date = $2", [req.userId, date]);
  const result = await pool.query(
    `INSERT INTO college_holidays (user_id, date, reason, source)
     VALUES ($1, $2, $3, 'manual')
     ON CONFLICT (user_id, date)
     DO UPDATE SET reason = EXCLUDED.reason
     RETURNING *`,
    [req.userId, date, reason || ""]
  );
  res.json({ holiday: result.rows[0] });
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
    `SELECT * FROM college_holidays WHERE ${conditions.join(" AND ")} ORDER BY date ASC`,
    params
  );
  res.json({ holidays: result.rows });
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const pool = getPool();
  await pool.query("DELETE FROM college_holidays WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
  res.json({ success: true });
}));

// Upload a photo or PDF of the college holiday list — Gemini reads it and
// every date found is marked as a holiday automatically.
router.post("/upload", asyncHandler(async (req, res) => {
  const { fileBase64, mimeType } = req.body;
  if (!fileBase64 || !mimeType) {
    return res.status(400).json({ error: "fileBase64 and mimeType are required" });
  }

  const systemInstruction = `You extract a list of holidays from a photo or PDF of a college holiday calendar/list.
Return ONLY a JSON array, no prose, in this exact shape:
[{"date": "YYYY-MM-DD", "reason": "string, e.g. Diwali, Republic Day, Founder's Day — empty string if not named"}]
Include every full-day closure you can find. If the list only shows day/month, infer the year from context (assume the nearest upcoming or current-year occurrence). If a range is given (e.g. "Dec 24-26"), expand it into one entry per date. If you cannot find any holidays, return [].`;

  const text = await callGemini({
    systemInstruction,
    parts: [{ inline_data: { mime_type: mimeType, data: fileBase64 } }, { text: "Extract the holiday list." }],
    jsonMode: true,
  });

  let holidays;
  try {
    holidays = safeParseJSON(text);
  } catch {
    return res.status(502).json({ error: "Couldn't read the holiday list clearly. Try a clearer photo or PDF." });
  }
  if (!Array.isArray(holidays)) holidays = [];

  const pool = getPool();
  let count = 0;
  for (const h of holidays) {
    if (!h.date) continue;
    await pool.query("DELETE FROM day_attendance WHERE user_id = $1 AND date = $2", [req.userId, h.date]);
    await pool.query(
      `INSERT INTO college_holidays (user_id, date, reason, source)
       VALUES ($1, $2, $3, 'upload')
       ON CONFLICT (user_id, date)
       DO UPDATE SET reason = EXCLUDED.reason, source = 'upload'`,
      [req.userId, h.date, h.reason || ""]
    );
    count += 1;
  }

  res.json({ count });
}));

export default router;
