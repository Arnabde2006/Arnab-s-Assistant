import express from "express";
import { getPool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { callGemini } from "../gemini.js";
import { safeParseJSON, toISO } from "../utils/dateHelpers.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();
router.use(requireAuth);

// ─── GET /api/subscriptions ──────────────────────────────────────────────────
router.get("/", asyncHandler(async (req, res) => {
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
  const { subIds } = req.body;
  if (!Array.isArray(subIds)) {
    return res.status(400).json({ error: "subIds array is required" });
  }

  const pool = getPool();
  // One round-trip: map each id to its position via unnest WITH ORDINALITY
  // (1-based, so subtract 1 to keep the original 0-based sort_order).
  await pool.query(
    `UPDATE subscriptions AS s
       SET sort_order = ids.ord - 1
     FROM unnest($1::uuid[]) WITH ORDINALITY AS ids(id, ord)
     WHERE s.id = ids.id AND s.user_id = $2`,
    [subIds, req.userId]
  );

  res.json({ success: true });
}));

// ─── POST /api/subscriptions ─────────────────────────────────────────────────
router.post("/", asyncHandler(async (req, res) => {
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
  const pool = getPool();
  await pool.query("DELETE FROM subscriptions WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
  res.json({ success: true });
}));

// ─── POST /api/subscriptions/bulk ───────────────────────────────────────────
router.post("/bulk", asyncHandler(async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Items array is required" });
  }

  const pool = getPool();

  // Keep only valid rows, then insert them all in one multi-row statement.
  // unnest turns the per-column arrays into rows; defaults match the old loop.
  const valid = items.filter((item) => item.name && item.renewal_date);
  if (valid.length === 0) {
    return res.status(201).json({ created: [], count: 0 });
  }

  const result = await pool.query(
    `INSERT INTO subscriptions
       (user_id, name, plan_type, amount, currency, billing_cycle, start_date, renewal_date, remind_days_before, notes)
     SELECT $1, name, plan_type, amount, currency, billing_cycle, COALESCE(start_date, CURRENT_DATE), renewal_date, remind_days_before, notes
     FROM unnest(
       $2::text[], $3::text[], $4::numeric[], $5::text[], $6::text[],
       $7::date[], $8::date[], $9::int[], $10::text[]
     ) AS t(name, plan_type, amount, currency, billing_cycle, start_date, renewal_date, remind_days_before, notes)
     RETURNING *, (renewal_date - CURRENT_DATE) AS days_remaining`,
    [
      req.userId,
      valid.map((i) => i.name.trim()),
      valid.map((i) => i.plan_type || "free_trial"),
      valid.map((i) => (i.amount !== undefined && i.amount !== "" ? Number(i.amount) : 0)),
      valid.map((i) => i.currency || "₹"),
      valid.map((i) => i.billing_cycle || "monthly"),
      valid.map((i) => i.start_date || null),
      valid.map((i) => i.renewal_date),
      valid.map((i) => (i.remind_days_before !== undefined && i.remind_days_before !== "" ? Number(i.remind_days_before) : 3)),
      valid.map((i) => (i.notes ? i.notes.trim() : "")),
    ]
  );

  const created = result.rows;
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
