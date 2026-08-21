import express from "express";
import { getPool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { callGemini } from "../gemini.js";
import { safeParseJSON } from "../utils/dateHelpers.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { computeFinanceSummary, isValidCategory, CATEGORIES } from "../lib/financeSummary.js";

const router = express.Router();
router.use(requireAuth);

router.get("/categories", (req, res) => {
  res.json({ categories: CATEGORIES });
});

router.post("/transactions", asyncHandler(async (req, res) => {
  const { date, amount, type, category, merchant, notes } = req.body;
  if (!date || !amount || !type) {
    return res.status(400).json({ error: "date, amount and type are required" });
  }
  if (!["expense", "income"].includes(type)) {
    return res.status(400).json({ error: "type must be expense or income" });
  }
  if (Number(amount) <= 0) {
    return res.status(400).json({ error: "amount must be greater than 0" });
  }
  const cat = category && isValidCategory(category) ? category : "other";
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO transactions (user_id, date, amount, type, category, merchant, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [req.userId, date, amount, type, cat, merchant || "", notes || ""]
  );
  res.status(201).json({ transaction: result.rows[0] });
}));

router.get("/transactions", asyncHandler(async (req, res) => {
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
    `SELECT * FROM transactions WHERE ${conditions.join(" AND ")} ORDER BY date DESC, created_at DESC`,
    params
  );
  res.json({ transactions: result.rows });
}));

router.put("/transactions/bulk", asyncHandler(async (req, res) => {
  const { ids, category, type } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "ids array is required" });
  }
  if (category && !isValidCategory(category)) {
    return res.status(400).json({ error: "invalid category" });
  }
  const pool = getPool();
  const updates = [];
  const params = [req.userId, ids];

  if (category) {
    params.push(category);
    updates.push(`category = $${params.length}`);
  }
  if (type && ["expense", "income"].includes(type)) {
    params.push(type);
    updates.push(`type = $${params.length}`);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: "No update fields provided" });
  }

  await pool.query(
    `UPDATE transactions SET ${updates.join(", ")} WHERE user_id = $1 AND id = ANY($2::uuid[])`,
    params
  );
  res.json({ success: true, updatedCount: ids.length });
}));

router.delete("/transactions/bulk", asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "ids array is required" });
  }
  const pool = getPool();
  await pool.query(
    "DELETE FROM transactions WHERE user_id = $1 AND id = ANY($2::uuid[])",
    [req.userId, ids]
  );
  res.json({ success: true, deletedCount: ids.length });
}));

router.put("/transactions/:id", asyncHandler(async (req, res) => {
  const { date, amount, type, category, merchant, notes } = req.body;
  if (type !== undefined && !["expense", "income"].includes(type)) {
    return res.status(400).json({ error: "type must be expense or income" });
  }
  if (amount !== undefined && Number(amount) <= 0) {
    return res.status(400).json({ error: "amount must be greater than 0" });
  }
  if (category !== undefined && !isValidCategory(category)) {
    return res.status(400).json({ error: "invalid category" });
  }
  const pool = getPool();
  const result = await pool.query(
    `UPDATE transactions SET
       date = COALESCE($1, date),
       amount = COALESCE($2, amount),
       type = COALESCE($3, type),
       category = COALESCE($4, category),
       merchant = COALESCE($5, merchant),
       notes = COALESCE($6, notes)
     WHERE id = $7 AND user_id = $8
     RETURNING *`,
    [date ?? null, amount ?? null, type ?? null, category ?? null, merchant ?? null, notes ?? null, req.params.id, req.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: "Transaction not found" });
  res.json({ transaction: result.rows[0] });
}));

router.delete("/transactions/:id", asyncHandler(async (req, res) => {
  const pool = getPool();
  await pool.query("DELETE FROM transactions WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
  res.json({ success: true });
}));

router.get("/summary", asyncHandler(async (req, res) => {
  const summary = await computeFinanceSummary(req.userId, req.query.month);
  res.json(summary);
}));

router.post("/upload", asyncHandler(async (req, res) => {
  const { fileBase64, mimeType, pdfText } = req.body;
  if (!fileBase64 && !pdfText) {
    return res.status(400).json({ error: "fileBase64 or pdfText is required" });
  }

  const systemInstruction = `You extract transactions from either (a) a bank account statement (a table of dated rows with a description and a debit or credit amount), or (b) a single UPI payment screenshot (e.g. Google Pay / PhonePe / Paytm success screen showing an amount and a "Paid to" or "Received from" name).
Return ONLY a JSON array, no prose, in this exact shape:
[{"date": "YYYY-MM-DD", "amount": number (always positive), "type": "expense" or "income", "merchant": "string — who was paid, or who paid you", "category": "one of: food, hostel, travel, subscriptions, shopping, education, entertainment, family, other"}]
Rules: for a bank statement, a debit/withdrawal is "expense" and a credit/deposit is "income". For a UPI screenshot, "Paid to X" is "expense" and "Received from X" is "income". Infer category from the merchant name where possible (e.g. Zomato/Swiggy/Domino's -> food, Uber/Ola/IRCTC -> travel, Netflix/Spotify/Prime -> subscriptions, Amazon/Myntra -> shopping) - use "other" if you can't tell. If the year isn't shown, assume the current year. Skip opening/closing balance rows and headers - only real transactions. If you can't find any transactions, return [].`;

  const parts = pdfText
    ? [{ text: `Bank Statement Text Content:\n\n${pdfText}` }, { text: "Extract all transactions from this bank statement." }]
    : [{ inline_data: { mime_type: mimeType, data: fileBase64 } }, { text: "Extract the transactions." }];

  const text = await callGemini({
    systemInstruction,
    parts,
    jsonMode: true,
  });

  let parsed;
  try {
    parsed = safeParseJSON(text);
  } catch {
    return res.status(502).json({ error: "Couldn't read that file clearly. Try a clearer photo or PDF. Nothing was changed." });
  }

  const entries = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.transactions) ? parsed.transactions : [];

  const validEntries = entries.filter(
    (e) => e.date && e.amount && ["expense", "income"].includes(e.type)
  );

  if (validEntries.length === 0) {
    return res.status(502).json({ error: "Couldn't find any valid transactions in that file. Try a clearer photo or PDF." });
  }

  const pool = getPool();

  // Build per-column arrays once. Dedup — against existing rows AND within this
  // same batch — is done in SQL so date/amount/type/merchant comparisons use
  // Postgres semantics (e.g. numeric equality) instead of fragile JS string keys.
  const dateArr = validEntries.map((e) => e.date);
  const amountArr = validEntries.map((e) => e.amount);
  const typeArr = validEntries.map((e) => e.type);
  const catArr = validEntries.map((e) => (isValidCategory(e.category) ? e.category : "other"));
  const merchantArr = validEntries.map((e) => (e.merchant || "").trim());

  // A candidate is inserted only if (a) no existing transaction matches it and
  // (b) it's the first occurrence of that key within this batch — mirroring the
  // old row-by-row loop, where each insert became visible to the next lookup.
  const result = await pool.query(
    `INSERT INTO transactions (user_id, date, amount, type, category, merchant, source)
     SELECT $1, c.date, c.amount, c.type, c.category, c.merchant, 'upload'
     FROM unnest($2::date[], $3::numeric[], $4::text[], $5::text[], $6::text[])
          WITH ORDINALITY AS c(date, amount, type, category, merchant, ord)
     WHERE NOT EXISTS (
       SELECT 1 FROM transactions t
       WHERE t.user_id = $1 AND t.date = c.date AND t.amount = c.amount
         AND t.type = c.type AND LOWER(t.merchant) = LOWER(c.merchant)
     )
     AND c.ord = (
       SELECT MIN(c2.ord)
       FROM unnest($2::date[], $3::numeric[], $4::text[], $5::text[], $6::text[])
            WITH ORDINALITY AS c2(date, amount, type, category, merchant, ord)
       WHERE c2.date = c.date AND c2.amount = c.amount AND c2.type = c.type
         AND LOWER(c2.merchant) = LOWER(c.merchant)
     )
     RETURNING *`,
    [req.userId, dateArr, amountArr, typeArr, catArr, merchantArr]
  );

  const inserted = result.rows;
  res.json({
    transactions: inserted,
    count: inserted.length,
    skippedCount: validEntries.length - inserted.length,
  });
}));

export default router;
