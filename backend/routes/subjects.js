import express from "express";
import { getPool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();
router.use(requireAuth);

router.get("/", asyncHandler(async (req, res) => {
  const pool = getPool();
  const result = await pool.query(
    "SELECT * FROM subjects WHERE user_id = $1 ORDER BY created_at ASC",
    [req.userId]
  );
  res.json({ subjects: result.rows });
}));

router.post("/", asyncHandler(async (req, res) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: "Subject name is required" });
  const pool = getPool();
  const result = await pool.query(
    "INSERT INTO subjects (user_id, name, color) VALUES ($1, $2, $3) RETURNING *",
    [req.userId, name, color || "#C9A227"]
  );
  res.status(201).json({ subject: result.rows[0] });
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const { name, color } = req.body;
  const pool = getPool();
  const result = await pool.query(
    `UPDATE subjects SET name = COALESCE($1, name), color = COALESCE($2, color)
     WHERE id = $3 AND user_id = $4 RETURNING *`,
    [name ?? null, color ?? null, req.params.id, req.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: "Subject not found" });
  res.json({ subject: result.rows[0] });
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const pool = getPool();
  await pool.query("DELETE FROM subjects WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
  res.json({ success: true });
}));

export default router;
