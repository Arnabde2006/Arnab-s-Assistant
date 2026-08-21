import { getPool } from "../db.js";

export async function computeAttendanceSummary(userId) {
  const pool = getPool();

  // These three reads are independent — run them concurrently. Attendance is
  // aggregated in SQL (GROUP BY status) instead of fetching every row and
  // counting in JS, since this powers both /attendance/summary and the public
  // /view/:token endpoint.
  const [userResult, statusResult, holidaysResult] = await Promise.all([
    pool.query("SELECT attendance_goal FROM users WHERE id = $1", [userId]),
    pool.query(
      "SELECT status, COUNT(*)::int AS count FROM day_attendance WHERE user_id = $1 GROUP BY status",
      [userId]
    ),
    pool.query("SELECT COUNT(*)::int AS count FROM college_holidays WHERE user_id = $1", [userId]),
  ]);

  const goal = userResult.rows[0]?.attendance_goal ?? 75;
  const holidaysCount = holidaysResult.rows[0]?.count ?? 0;

  const counts = { present: 0, absent: 0, half_day: 0 };
  for (const row of statusResult.rows) {
    counts[row.status] = row.count;
  }
  const present = counts.present;
  const absent = counts.absent;
  const halfDay = counts.half_day;
  const total = present + absent + halfDay;
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
