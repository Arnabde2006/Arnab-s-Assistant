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
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
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
       sort_order ASC,
       CASE WHEN status = 'active' THEN 0 ELSE 1 END,
       renewal_date ASC`,
    [req.userId]
  );
  res.json({ subscriptions: result.rows });
}));

// ─── PUT /api/subscriptions/reorder ─────────────────────────────────────────
router.put("/reorder", asyncHandler(async (req, res) => {
  await ensureTable();
  const { subIds } = req.body;
  if (!Array.isArray(subIds)) {
    return res.status(400).json({ error: "subIds array is required" });
  }

  const pool = getPool();
  for (let i = 0; i < subIds.length; i++) {
    await pool.query(
      "UPDATE subscriptions SET sort_order = $1 WHERE id = $2 AND user_id = $3",
      [i, subIds[i], req.userId]
    );
  }

  res.json({ success: true });
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

// ─── POST /api/subscriptions/bulk ───────────────────────────────────────────
router.post("/bulk", asyncHandler(async (req, res) => {
  await ensureTable();
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Items array is required" });
  }

  const pool = getPool();
  const created = [];

  for (const item of items) {
    if (!item.name || !item.renewal_date) continue;
    const result = await pool.query(
      `INSERT INTO subscriptions
       (user_id, name, plan_type, amount, currency, billing_cycle, start_date, renewal_date, remind_days_before, notes)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, CURRENT_DATE), $8, $9, $10)
       RETURNING *, (renewal_date - CURRENT_DATE) AS days_remaining`,
      [
        req.userId,
        item.name.trim(),
        item.plan_type || "free_trial",
        item.amount !== undefined && item.amount !== "" ? Number(item.amount) : 0,
        item.currency || "₹",
        item.billing_cycle || "monthly",
        item.start_date || null,
        item.renewal_date,
        item.remind_days_before !== undefined && item.remind_days_before !== "" ? Number(item.remind_days_before) : 3,
        item.notes ? item.notes.trim() : "",
      ]
    );
    if (result.rows[0]) created.push(result.rows[0]);
  }

  res.status(201).json({ created, count: created.length });
}));

// ─── POST /api/subscriptions/parse-screenshot ───────────────────────────────
router.post("/parse-screenshot", asyncHandler(async (req, res) => {
  const { fileBase64, mimeType } = req.body;
  if (!fileBase64 || !mimeType) {
    return res.status(400).json({ error: "fileBase64 and mimeType are required" });
  }

  const todayStr = toISO(new Date());

  const systemInstruction = `You extract subscription and free trial details from an image or screenshot (e.g. Crunchyroll, Netflix, Spotify, Amazon Prime, YouTube Premium, Apple Subscriptions list, Google Play Subscriptions list, bank recurring payments, email summary, etc.).
Today's date is ${todayStr}.

Extract ALL subscriptions and free trials visible in the image and return ONLY a JSON object with a "subscriptions" array:
{
  "subscriptions": [
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
  ]
}

Rules:
1. If the screenshot lists multiple subscriptions, include EVERY subscription visible in the list.
2. If details like amount or currency aren't clearly visible, use reasonable defaults (amount: 0, currency: "₹", plan_type: "free_trial", billing_cycle: "monthly").
3. Always infer or calculate renewal_date as YYYY-MM-DD.
4. If no subscriptions can be found, return {"subscriptions": []}.`;

  const text = await callGemini({
    systemInstruction,
    parts: [
      { inline_data: { mime_type: mimeType, data: fileBase64 } },
      { text: "Extract all subscription details from this image." },
    ],
    jsonMode: true,
  });

  let parsed;
  try {
    parsed = safeParseJSON(text);
  } catch {
    return res.status(502).json({ error: "Couldn't read subscription details from the image clearly. Please try another screenshot or enter manually." });
  }

  let list = [];
  if (Array.isArray(parsed)) {
    list = parsed;
  } else if (Array.isArray(parsed?.subscriptions)) {
    list = parsed.subscriptions;
  } else if (parsed?.name) {
    list = [parsed];
  }

  const validItems = list.map((item) => ({
    name: item.name || "Subscription",
    plan_type: item.plan_type || "free_trial",
    amount: item.amount !== undefined ? Number(item.amount) : 0,
    currency: item.currency || "₹",
    billing_cycle: item.billing_cycle || "monthly",
    start_date: item.start_date || todayStr,
    renewal_date: item.renewal_date || toISO(new Date(Date.now() + 30 * 86400000)),
    remind_days_before: item.remind_days_before || 3,
    notes: item.notes || "Extracted from screenshot via AI",
  }));

  res.json({ subscriptions: validItems, extracted: validItems[0] || null });
}));

export default router;
