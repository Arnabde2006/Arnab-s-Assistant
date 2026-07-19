import express from "express";
import { getPool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { parseNoteDate } from "../utils/parseDate.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();
router.use(requireAuth);

// Create a todo. If `date` is not explicitly provided, parse it from the note text.
router.post("/", asyncHandler(async (req, res) => {
  const { text, date, priority } = req.body;
  if (!text) return res.status(400).json({ error: "Note text is required" });

  let finalText = text;
  let finalDate = date;
  if (!finalDate) {
    const parsed = parseNoteDate(text);
    finalText = parsed.text || text;
    finalDate = parsed.date;
  }

  const pool = getPool();
  const result = await pool.query(
    "INSERT INTO todos (user_id, text, date, priority) VALUES ($1, $2, $3, $4) RETURNING *",
    [req.userId, finalText, finalDate, priority || "normal"]
  );
  res.status(201).json({ todo: result.rows[0] });
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
    `SELECT * FROM todos WHERE ${conditions.join(" AND ")} ORDER BY date ASC, created_at ASC`,
    params
  );
  res.json({ todos: result.rows });
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const { text, date, priority, done } = req.body;
  const pool = getPool();
  const result = await pool.query(
    `UPDATE todos SET
       text = COALESCE($1, text),
       date = COALESCE($2, date),
       priority = COALESCE($3, priority),
       done = COALESCE($4, done)
     WHERE id = $5 AND user_id = $6
     RETURNING *`,
    [text ?? null, date ?? null, priority ?? null, done ?? null, req.params.id, req.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: "Todo not found" });
  res.json({ todo: result.rows[0] });
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const pool = getPool();
  await pool.query("DELETE FROM todos WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
  res.json({ success: true });
}));

export default router;
