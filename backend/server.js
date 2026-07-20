// Dev reload trigger
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { connectDB } from "./db.js";
import authRoutes from "./routes/auth.js";
import subjectRoutes from "./routes/subjects.js";
import attendanceRoutes from "./routes/attendance.js";
import todoRoutes from "./routes/todos.js";
import timetableRoutes from "./routes/timetable.js";
import dashboardRoutes from "./routes/dashboard.js";
import aiRoutes from "./routes/ai.js";
import viewRoutes from "./routes/view.js";
import holidayRoutes from "./routes/holidays.js";
import financeRoutes from "./routes/finance.js";
import debtRoutes from "./routes/debts.js";

// Fail fast at startup if required secrets are missing, rather than
// surfacing a confusing 500 error on the first request that needs them.
const required = ["DATABASE_URL", "JWT_SECRET"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing required environment variable(s): ${missing.join(", ")}. Check your .env file.`);
  process.exit(1);
}
if (!process.env.GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY is not set — chat, exam-timetable, holiday-list, and grade-card AI features will fail until it's added.");
}
if (!process.env.CLIENT_ORIGIN) {
  console.warn("CLIENT_ORIGIN is not set — CORS currently allows requests from any origin. Set this in production.");
}

const app = express();

// Sets standard security headers (X-Content-Type-Options, etc). CSP is left
// off since this is a pure JSON API with no HTML views to protect.
app.use(helmet({ contentSecurityPolicy: false }));

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "*",
  })
);
app.use(express.json({ limit: "15mb" }));

// General limiter for the whole API — generous, just a backstop against abuse/DoS.
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Tighter limiter for auth — makes password brute-forcing impractical.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again in a few minutes." },
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

// Tighter limiter for AI routes — each call costs real Gemini API usage.
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many AI requests. Please slow down and try again shortly." },
});
// Apply tighter rate limiter only to routes that actually use Gemini API
app.use("/api/ai/chat", aiLimiter);
app.use("/api/ai/exam-timetable", aiLimiter);
app.use("/api/ai/grade-card", aiLimiter);
app.use("/api/holidays/upload", aiLimiter);
app.use("/api/finance/upload", aiLimiter);

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/todos", todoRoutes);
app.use("/api/timetable", timetableRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/view", viewRoutes);
app.use("/api/holidays", holidayRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/debts", debtRoutes);

// Catch-all for unknown routes.
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Central error handler — every route is wrapped in asyncHandler (see
// utils/asyncHandler.js), so any thrown/rejected error lands here instead
// of crashing the process. Never leak internal error details to the client.
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: "Something went wrong. Please try again." });
});

// Last-resort safety net: log instead of letting an unhandled rejection
// anywhere else in the process take the whole server down.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to connect to the database:", err.message);
    process.exit(1);
  });
