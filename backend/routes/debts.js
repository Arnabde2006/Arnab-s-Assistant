import express from "express";
import { getPool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();
router.use(requireAuth);

router.post("/", asyncHandler(async (req, res) => {
  const { personName, amount, direction, note, date } = req.body;
  if (!personName || !amount || !direction) {
    return res.status(400).json({ error: "personName, amount and direction are required" });
  }
  if (!["owed_to_me", "i_owe"].includes(direction)) {
    return res.status(400).json({ error: "direction must be owed_to_me or i_owe" });
  }
  if (Number(amount) <= 0) {
    return res.status(400).json({ error: "amount must be greater than 0" });
  }
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO debts (user_id, person_name, amount, direction, note, date)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, CURRENT_DATE)) RETURNING *`,
    [req.userId, personName, amount, direction, note || "", date || null]
  );
  res.status(201).json({ debt: result.rows[0] });
}));

router.get("/", asyncHandler(async (req, res) => {
  const { settled } = req.query;
  const pool = getPool();
  const conditions = ["user_id = $1"];
  const params = [req.userId];
  if (settled === "true" || settled === "false") {
    params.push(settled === "true");
    conditions.push(`settled = $${params.length}`);
  }
  const result = await pool.query(
    `SELECT * FROM debts WHERE ${conditions.join(" AND ")} ORDER BY settled ASC, date DESC, created_at DESC`,
    params
  );
  res.json({ debts: result.rows });
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const { personName, amount, direction, note, date } = req.body;
  if (direction !== undefined && !["owed_to_me", "i_owe"].includes(direction)) {
    return res.status(400).json({ error: "direction must be owed_to_me or i_owe" });
  }
  if (amount !== undefined && Number(amount) <= 0) {
    return res.status(400).json({ error: "amount must be greater than 0" });
  }
  const pool = getPool();
  const result = await pool.query(
    `UPDATE debts SET
       person_name = COALESCE($1, person_name),
       amount = COALESCE($2, amount),
       direction = COALESCE($3, direction),
       note = COALESCE($4, note),
       date = COALESCE($5, date)
     WHERE id = $6 AND user_id = $7
     RETURNING *`,
    [personName ?? null, amount ?? null, direction ?? null, note ?? null, date ?? null, req.params.id, req.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: "Debt not found" });
  res.json({ debt: result.rows[0] });
}));

router.post("/:id/settle", asyncHandler(async (req, res) => {
  const pool = getPool();
  const result = await pool.query(
    "UPDATE debts SET settled = true, settled_at = now() WHERE id = $1 AND user_id = $2 RETURNING *",
    [req.params.id, req.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: "Debt not found" });
  res.json({ debt: result.rows[0] });
}));

router.post("/:id/unsettle", asyncHandler(async (req, res) => {
  const pool = getPool();
  const result = await pool.query(
    "UPDATE debts SET settled = false, settled_at = NULL WHERE id = $1 AND user_id = $2 RETURNING *",
    [req.params.id, req.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: "Debt not found" });
  res.json({ debt: result.rows[0] });
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const pool = getPool();
  await pool.query("DELETE FROM debts WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
  res.json({ success: true });
}));

export default router;
