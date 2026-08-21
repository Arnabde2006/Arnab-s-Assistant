// One-time data fix: recompute NPTEL assignment due dates for courses that were
// created with the older week-offset (Week 1 due ~1 week after start instead of
// ~2). This logic used to run on EVERY `GET /api/nptel` request; it now lives
// here so the read path stays fast. Safe to run repeatedly — it only touches
// courses whose Week 1 due date is still less than 12 days after the start date.
//
// Usage: npm run fix:nptel
import "dotenv/config";
import pkg from "pg";
import { calculateWeeklyDueDate } from "../utils/nptelDates.js";
import { toISO } from "../utils/dateHelpers.js";

const { Pool } = pkg;

async function run() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set in .env");
  }
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const coursesRes = await pool.query(
    "SELECT id, start_date, duration_weeks, assignment_due_day FROM nptel_courses"
  );

  let coursesFixed = 0;
  let rowsUpdated = 0;

  for (const c of coursesRes.rows) {
    const startDateStr = toISO(new Date(c.start_date));
    const w1Res = await pool.query(
      "SELECT due_date FROM nptel_assignments WHERE course_id = $1 AND week_number = 1",
      [c.id]
    );
    if (w1Res.rows.length === 0 || !w1Res.rows[0].due_date) continue;

    const w1Due = new Date(w1Res.rows[0].due_date);
    const startD = new Date(startDateStr + "T00:00:00");
    const diffDays = Math.round((w1Due - startD) / (1000 * 60 * 60 * 24));
    if (diffDays >= 12) continue; // already on the current offset

    for (let w = 1; w <= c.duration_weeks; w++) {
      const newDueDate = calculateWeeklyDueDate(startDateStr, w, c.assignment_due_day);
      const upd = await pool.query(
        "UPDATE nptel_assignments SET due_date = $1 WHERE course_id = $2 AND week_number = $3",
        [newDueDate, c.id, w]
      );
      rowsUpdated += upd.rowCount;
    }
    coursesFixed += 1;
  }

  console.log(`NPTEL due-date fix complete. Courses corrected: ${coursesFixed}, assignment rows updated: ${rowsUpdated}.`);
  await pool.end();
}

run().catch((err) => {
  console.error("NPTEL due-date fix failed:", err.message);
  process.exit(1);
});
