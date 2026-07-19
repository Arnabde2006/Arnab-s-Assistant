const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

function pad(n) {
  return String(n).padStart(2, "0");
}

function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Parses a free-text note like "submit assignment fri" or "lab report tomorrow"
// and returns { text, date } where date defaults to today if nothing is found.
export function parseNoteDate(rawText, referenceDate = new Date()) {
  const text = rawText.trim();
  const lower = text.toLowerCase();
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  // explicit date formats: 2026-07-25 or 25/07 or 25-07-2026
  const isoMatch = lower.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (isoMatch) {
    const d = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    return { text: stripMatch(text, isoMatch[0]), date: toISO(d) };
  }
  const dmyMatch = lower.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]) - 1;
    const year = dmyMatch[3] ? (dmyMatch[3].length === 2 ? 2000 + Number(dmyMatch[3]) : Number(dmyMatch[3])) : today.getFullYear();
    const d = new Date(year, month, day);
    return { text: stripMatch(text, dmyMatch[0]), date: toISO(d) };
  }

  // "in N days"
  const inDaysMatch = lower.match(/\bin (\d+) days?\b/);
  if (inDaysMatch) {
    const d = new Date(today);
    d.setDate(d.getDate() + Number(inDaysMatch[1]));
    return { text: stripMatch(text, inDaysMatch[0]), date: toISO(d) };
  }

  if (/\btomorrow\b/.test(lower)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return { text: stripMatch(text, "tomorrow"), date: toISO(d) };
  }
  if (/\btoday\b/.test(lower)) {
    return { text: stripMatch(text, "today"), date: toISO(today) };
  }

  // month name + day, e.g. "aug 12" or "12 aug"
  for (let i = 0; i < MONTHS.length; i++) {
    const mon = MONTHS[i];
    const re1 = new RegExp(`\\b${mon}[a-z]*\\s+(\\d{1,2})\\b`);
    const re2 = new RegExp(`\\b(\\d{1,2})\\s+${mon}[a-z]*\\b`);
    let m = lower.match(re1);
    let day;
    if (m) day = Number(m[1]);
    else {
      m = lower.match(re2);
      if (m) day = Number(m[1]);
    }
    if (m) {
      let year = today.getFullYear();
      let d = new Date(year, i, day);
      if (d < today) d = new Date(year + 1, i, day);
      return { text: stripMatch(text, m[0]), date: toISO(d) };
    }
  }

  // weekday names, e.g. "fri", "friday", "next monday"
  for (let i = 0; i < WEEKDAYS.length; i++) {
    const wd = WEEKDAYS[i];
    const short = wd.slice(0, 3);
    const re = new RegExp(`\\b(next\\s+)?(${wd}|${short})\\b`);
    const m = lower.match(re);
    if (m) {
      const isNext = !!m[1];
      const d = new Date(today);
      let diff = (i - d.getDay() + 7) % 7;
      if (diff === 0) diff = isNext ? 7 : 0;
      if (isNext && diff < 7) diff += 7;
      d.setDate(d.getDate() + diff);
      return { text: stripMatch(text, m[0]), date: toISO(d) };
    }
  }

  // nothing matched: default to today
  return { text, date: toISO(today) };
}

function stripMatch(text, match) {
  const re = new RegExp(`\\s*\\b${match.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b\\s*`, "i");
  return text.replace(re, " ").replace(/\s+/g, " ").trim();
}
