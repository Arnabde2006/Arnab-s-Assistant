// Shared date and currency formatting.
//
// Every helper here was duplicated across the pages before Tier C: `toISO` in
// four files, the rupee formatter in two, and the local-midnight date parse in
// eight. They are pure functions of their arguments, so there is no reason for
// more than one copy of any of them to exist.
//
// `pad` and `toISO` intentionally mirror `backend/utils/dateHelpers.js`, so the
// two sides of the wire agree on what a date string looks like. If you change
// one, change the other.

/** Two-digit zero-pad, for building `YYYY-MM-DD` / `YYYY-MM` strings. */
export function pad(n) {
  return String(n).padStart(2, "0");
}

/**
 * A `Date` to `"YYYY-MM-DD"` using its *local* calendar fields.
 *
 * Deliberately not `toISOString().slice(0, 10)`, which converts to UTC first
 * and so returns the previous day for any local time before the UTC offset.
 */
export function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Parse a `"YYYY-MM-DD"` string as *local* midnight.
 *
 * `new Date("2026-08-21")` is specified to parse date-only strings as UTC
 * midnight, so west of Greenwich it renders as the 20th. Appending a time makes
 * the engine use the local zone instead. Dates in this app are plain calendar
 * dates with no zone attached, so local is the correct reading -- otherwise a
 * due date can display as the day before it is due.
 */
export function parseLocalDate(dateStr) {
  return new Date(dateStr + "T00:00:00");
}

/** e.g. `"Fri, 21 Aug"` -- for dates near today, where the weekday is useful. */
export function formatShortDate(dateStr) {
  if (!dateStr) return "";
  return parseLocalDate(dateStr).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** e.g. `"Aug 21, 2026"` -- for dates that may be far from today. */
export function formatMediumDate(dateStr) {
  if (!dateStr) return "";
  return parseLocalDate(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Indian-grouped rupee amount, e.g. `"₹1,20,000.5"`.
 *
 * `maximumFractionDigits: 2` rather than `toFixed(2)`, so whole amounts read as
 * `₹1,200` instead of `₹1,200.00`. Named for the currency it hardcodes; if a
 * second currency ever needs formatting, that is the point to generalise.
 */
export function rupees(n) {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
