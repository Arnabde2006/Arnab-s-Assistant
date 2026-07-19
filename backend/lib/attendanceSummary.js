import { getPool } from "../db.js";

export async function computeAttendanceSummary(userId) {
  const pool = getPool();
  const userResult = await pool.query("SELECT attendance_goal FROM users WHERE id = $1", [userId]);
  const goal = userResult.rows[0]?.attendance_goal ?? 75;

  const recordsResult = await pool.query("SELECT * FROM day_attendance WHERE user_id = $1", [userId]);
  const records = recordsResult.rows;
  const holidaysResult = await pool.query("SELECT COUNT(*)::int AS count FROM college_holidays WHERE user_id = $1", [userId]);
  const holidaysCount = holidaysResult.rows[0]?.count ?? 0;

  const total = records.length;
  const present = records.filter((r) => r.status === "present").length;
  const absent = records.filter((r) => r.status === "absent").length;
  const halfDay = records.filter((r) => r.status === "half_day").length;
  const effectivePresent = present + halfDay * 0.5;
  const percentage = total === 0 ? 0 : (effectivePresent / total) * 100;

  let safeToMiss = 0;
  if (total > 0) {
    safeToMiss = Math.max(0, Math.floor((effectivePresent * 100) / goal - total));
  }
  let daysNeeded = 0;
  if (percentage < goal) {
    const g = goal / 100;
    const y = (g * total - effectivePresent) / (1 - g);
    daysNeeded = Math.max(0, Math.ceil(y));
  }

  // "According to college" — each day is worth 2 points (most colleges count
  // a day as two periods/sessions): full present = 2, half day = 1, absent = 0.
  const collegeEarned = present * 2 + halfDay * 1;
  const collegeMax = total * 2;
  const collegePercentage = collegeMax === 0 ? 0 : (collegeEarned / collegeMax) * 100;

  let collegeSafeToMiss = 0;
  if (collegeMax > 0) {
    collegeSafeToMiss = Math.max(0, Math.floor((collegeEarned * 100) / goal / 2 - total));
  }
  let collegeDaysNeeded = 0;
  if (collegePercentage < goal) {
    const g = goal / 100;
    const x = (g * collegeMax - collegeEarned) / (2 * (1 - g));
    collegeDaysNeeded = Math.max(0, Math.ceil(x));
  }

  return {
    total,
    present,
    absent,
    halfDay,
    holidaysCount,
    percentage: Math.round(percentage * 10) / 10,
    goal,
    safeToMiss,
    daysNeeded,
    college: {
      earnedPoints: collegeEarned,
      maxPoints: collegeMax,
      percentage: Math.round(collegePercentage * 10) / 10,
      safeToMiss: collegeSafeToMiss,
      daysNeeded: collegeDaysNeeded,
    },
  };
}
