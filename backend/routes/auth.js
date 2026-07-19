import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { getPool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

function newViewToken() {
  return crypto.randomBytes(24).toString("hex");
}

function toUserDTO(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    attendanceGoal: row.attendance_goal,
    viewToken: row.view_token,
  };
}

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    const pool = getPool();
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const viewToken = newViewToken();
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, view_token) VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, attendance_goal, view_token`,
      [name, email.toLowerCase(), passwordHash, viewToken]
    );
    const user = result.rows[0];
    const token = signToken(user.id);
    res.status(201).json({ token, user: toUserDTO(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const pool = getPool();
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [(email || "").toLowerCase()]);
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    // Accounts created before the view-link feature won't have a token yet — backfill on login.
    if (!user.view_token) {
      const viewToken = newViewToken();
      await pool.query("UPDATE users SET view_token = $1 WHERE id = $2", [viewToken, user.id]);
      user.view_token = viewToken;
    }
    const token = signToken(user.id);
    res.json({ token, user: toUserDTO(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

router.get("/me", requireAuth, asyncHandler(async (req, res) => {
  const pool = getPool();
  const result = await pool.query(
    "SELECT id, name, email, attendance_goal, view_token FROM users WHERE id = $1",
    [req.userId]
  );
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: toUserDTO(user) });
}));

router.put("/me", requireAuth, asyncHandler(async (req, res) => {
  const { name, attendanceGoal } = req.body;
  if (attendanceGoal !== undefined && (typeof attendanceGoal !== "number" || attendanceGoal < 1 || attendanceGoal > 100)) {
    return res.status(400).json({ error: "attendanceGoal must be a number between 1 and 100" });
  }
  const pool = getPool();
  const result = await pool.query(
    `UPDATE users SET
       name = COALESCE($1, name),
       attendance_goal = COALESCE($2, attendance_goal)
     WHERE id = $3
     RETURNING id, name, email, attendance_goal, view_token`,
    [name ?? null, attendanceGoal ?? null, req.userId]
  );
  res.json({ user: toUserDTO(result.rows[0]) });
}));

// Invalidate the old view-only link and issue a new one (e.g. if you shared it by mistake).
router.post("/view-token/regenerate", requireAuth, asyncHandler(async (req, res) => {
  const pool = getPool();
  const viewToken = newViewToken();
  const result = await pool.query(
    "UPDATE users SET view_token = $1 WHERE id = $2 RETURNING id, name, email, attendance_goal, view_token",
    [viewToken, req.userId]
  );
  res.json({ user: toUserDTO(result.rows[0]) });
}));

export default router;
