import express from "express";
import { getPool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { callGemini } from "../gemini.js";
import { safeParseJSON, toISO } from "../utils/dateHelpers.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();
router.use(requireAuth);

// Ensure table exists safely on route load if migration wasn't manually run
let tableEnsured = false;
async function ensureTable() {
  if (tableEnsured) return;
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      plan_type TEXT NOT NULL DEFAULT 'free_trial' CHECK (plan_type IN ('free_trial', 'paid')),
      amount NUMERIC NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT '₹',
      billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly', 'one_time')),
      start_date DATE NOT NULL DEFAULT CURRENT_DATE,
      renewal_date DATE NOT NULL,
      remind_days_before INTEGER NOT NULL DEFAULT 3,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'paused')),
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id, status);
  `);
  tableEnsured = true;
}

// ─── GET /api/subscriptions ──────────────────────────────────────────────────
router.get("/", asyncHandler(async (req, res) => {
  await ensureTable();
  const pool = getPool();
  const result = await pool.query(
    `SELECT *,
      (renewal_date - CURRENT_DATE) AS days_remaining
     FROM subscriptions
     WHERE user_id = $1
     ORDER BY
       CASE WHEN status = 'active' THEN 0 ELSE 1 END,
       renewal_date ASC`,
    [req.userId]
  );
  res.json({ subscriptions: result.rows });
}));

// ─── POST /api/subscriptions ─────────────────────────────────────────────────
router.post("/", asyncHandler(async (req, res) => {
  await ensureTable();
  const { name, plan_type, amount, currency, billing_cycle, start_date, renewal_date, remind_days_before, notes } = req.body;

  if (!name || !renewal_date) {
    return res.status(400).json({ error: "Service name and renewal/charge date are required" });
  }

  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO subscriptions
     (user_id, name, plan_type, amount, currency, billing_cycle, start_date, renewal_date, remind_days_before, notes)
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, CURRENT_DATE), $8, $9, $10)
     RETURNING *, (renewal_date - CURRENT_DATE) AS days_remaining`,
    [
      req.userId,
      name.trim(),
      plan_type || "free_trial",
      amount !== undefined && amount !== "" ? Number(amount) : 0,
      currency || "₹",
      billing_cycle || "monthly",
      start_date || null,
      renewal_date,
      remind_days_before !== undefined && remind_days_before !== "" ? Number(remind_days_before) : 3,
      notes ? notes.trim() : "",
    ]
  );

  res.status(201).json({ subscription: result.rows[0] });
}));

// ─── PUT /api/subscriptions/:id ──────────────────────────────────────────────
router.put("/:id", asyncHandler(async (req, res) => {
  await ensureTable();
  const { name, plan_type, amount, currency, billing_cycle, renewal_date, remind_days_before, status, notes } = req.body;

  const pool = getPool();
  const result = await pool.query(
    `UPDATE subscriptions SET
       name = COALESCE($1, name),
       plan_type = COALESCE($2, plan_type),
       amount = COALESCE($3, amount),
       currency = COALESCE($4, currency),
       billing_cycle = COALESCE($5, billing_cycle),
       renewal_date = COALESCE($6, renewal_date),
       remind_days_before = COALESCE($7, remind_days_before),
       status = COALESCE($8, status),
       notes = COALESCE($9, notes)
     WHERE id = $10 AND user_id = $11
     RETURNING *, (renewal_date - CURRENT_DATE) AS days_remaining`,
    [
      name !== undefined ? name.trim() : null,
      plan_type ?? null,
      amount !== undefined && amount !== null ? Number(amount) : null,
      currency ?? null,
      billing_cycle ?? null,
      renewal_date ?? null,
      remind_days_before !== undefined && remind_days_before !== null ? Number(remind_days_before) : null,
      status ?? null,
      notes !== undefined ? notes.trim() : null,
      req.params.id,
      req.userId,
    ]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Subscription not found" });
  }

  res.json({ subscription: result.rows[0] });
}));

// ─── DELETE /api/subscriptions/:id ───────────────────────────────────────────
router.delete("/:id", asyncHandler(async (req, res) => {
  await ensureTable();
  const pool = getPool();
  await pool.query("DELETE FROM subscriptions WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
  res.json({ success: true });
}));

// ─── POST /api/subscriptions/parse-screenshot ───────────────────────────────
router.post("/parse-screenshot", asyncHandler(async (req, res) => {
  const { fileBase64, mimeType } = req.body;
  if (!fileBase64 || !mimeType) {
    return res.status(400).json({ error: "fileBase64 and mimeType are required" });
  }

  const todayStr = toISO(new Date());

  const systemInstruction = `You extract subscription and free trial details from an image or screenshot (e.g., Crunchyroll, Netflix, Spotify, Amazon Prime, YouTube Premium, etc.).
Today's date is ${todayStr}.

Extract details and return ONLY a JSON object (no markdown formatting outside of JSON) with these fields:
{
  "name": "string (e.g. Crunchyroll)",
  "plan_type": "free_trial or paid",
  "amount": number (e.g. 99.00 or 0),
  "currency": "string (e.g. ₹ or $ or €)",
  "billing_cycle": "monthly or yearly or one_time",
  "renewal_date": "YYYY-MM-DD (e.g. 2026-08-26. If the screenshot mentions '31 days left' or 'ends in X days' relative to today, calculate the exact date based on today's date ${todayStr})",
  "remind_days_before": 3,
  "notes": "string (e.g. Free Trial / 31 days left. Auto-renews at ₹99.00/month starting August 26, 2026)"
}

If details like amount or currency aren't clearly visible, use reasonable defaults (amount: 0, currency: "₹", plan_type: "free_trial", billing_cycle: "monthly").
Always infer or calculate the renewal_date as YYYY-MM-DD.`;

  const text = await callGemini({
    systemInstruction,
    parts: [
      { inline_data: { mime_type: mimeType, data: fileBase64 } },
      { text: "Extract subscription details from this image." },
    ],
    jsonMode: true,
  });

  let parsed;
  try {
    parsed = safeParseJSON(text);
  } catch {
    return res.status(502).json({ error: "Couldn't read subscription details from the image clearly. Please try another screenshot or enter manually." });
  }

  res.json({ extracted: parsed });
}));

export default router;
