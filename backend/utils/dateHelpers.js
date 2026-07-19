export function pad(n) {
  return String(n).padStart(2, "0");
}

export function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Gemini sometimes wraps JSON responses in ```json fences even when asked not to — strip and parse.
export function safeParseJSON(text) {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  return JSON.parse(cleaned);
}
