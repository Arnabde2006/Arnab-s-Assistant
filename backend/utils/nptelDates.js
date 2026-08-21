import { toISO } from "./dateHelpers.js";

// NPTEL Week 1 assignment is due ~2 weeks after the course start date
// (e.g. Aug 5 for a July 20 start), then weekly. The computed base date is
// nudged to the nearest target weekday (Wednesday = 3 by default).
export function calculateWeeklyDueDate(startDateStr, weekNum, targetDayOfWeek = 3) {
  const start = new Date(startDateStr + "T00:00:00");
  const baseDate = new Date(start);
  baseDate.setDate(baseDate.getDate() + ((weekNum + 1) * 7));

  const currentDay = baseDate.getDay();
  const diff = targetDayOfWeek - currentDay;
  baseDate.setDate(baseDate.getDate() + diff);

  return toISO(baseDate);
}
