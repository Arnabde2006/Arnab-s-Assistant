const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";

function endpoint() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not set in .env");
  }
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
}

/**
 * Calls Gemini's generateContent endpoint.
 * @param {object} opts
 * @param {string} [opts.systemInstruction] - system prompt
 * @param {Array} opts.parts - array of { text } and/or { inline_data: { mime_type, data } } parts
 * @param {boolean} [opts.jsonMode] - if true, asks Gemini to return strict JSON
 */
export async function callGemini({ systemInstruction, parts, jsonMode }) {
  const body = {
    contents: [{ role: "user", parts }],
    ...(systemInstruction
      ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
      : {}),
    ...(jsonMode ? { generationConfig: { responseMimeType: "application/json" } } : {}),
  };

  const res = await fetch(endpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    const message = data?.error?.message || "Gemini API request failed";
    throw new Error(message);
  }

  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  return text;
}
