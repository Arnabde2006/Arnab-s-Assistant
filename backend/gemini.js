/**
 * AI gateway — races Gemini, Groq, and OpenRouter in parallel.
 * The first provider to succeed wins; the others are abandoned.
 * 
 * For streaming (SSE) the caller passes `onChunk(text)` — each provider
 * that supports streaming will call it incrementally.  For non-streaming
 * callers (grade-card / exam-timetable JSON extraction) omit `onChunk`.
 */

// ─── helpers ─────────────────────────────────────────────────────────────────

function hasVision(parts) {
  return parts.some((p) => p.inline_data);
}

function convertPartsToMessages(systemInstruction, parts) {
  const messages = [];
  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }

  const content = [];
  for (const part of parts) {
    if (part.text) {
      content.push({ type: "text", text: part.text });
    } else if (part.inline_data) {
      const { mime_type: mime, data: base64 } = part.inline_data;
      content.push({
        type: "image_url",
        image_url: { url: `data:${mime};base64,${base64}` },
      });
    }
  }

  if (content.length === 1 && content[0].type === "text") {
    messages.push({ role: "user", content: content[0].text });
  } else {
    messages.push({ role: "user", content });
  }
  return messages;
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

function geminiEndpoint(stream = false) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const method = stream ? "streamGenerateContent" : "generateContent";
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}?key=${key}${stream ? "&alt=sse" : ""}`;
}

async function tryGemini({ systemInstruction, parts, jsonMode, onChunk }) {
  const body = {
    contents: [{ role: "user", parts }],
    ...(systemInstruction
      ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
      : {}),
    ...(jsonMode ? { generationConfig: { responseMimeType: "application/json" } } : {}),
  };

  const useStream = !!onChunk && !jsonMode;
  const res = await fetch(geminiEndpoint(useStream), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error?.message || `Gemini HTTP ${res.status}`);
  }

  if (!useStream) {
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  }

  // Streaming: parse SSE
  let full = "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop(); // keep incomplete line
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (raw === "[DONE]") continue;
      try {
        const obj = JSON.parse(raw);
        const chunk =
          obj?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
        if (chunk) {
          full += chunk;
          onChunk(chunk);
        }
      } catch { /* malformed chunk — skip */ }
    }
  }
  return full;
}

// ─── Groq ─────────────────────────────────────────────────────────────────────

async function tryGroq({ systemInstruction, parts, jsonMode, onChunk }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  const vision = hasVision(parts);
  const model = vision
    ? (process.env.GROQ_VISION_MODEL || "llama-3.2-11b-vision-preview")
    : (process.env.GROQ_MODEL || "llama-3.3-70b-versatile");

  const useStream = !!onChunk && !jsonMode && !vision;
  const messages = convertPartsToMessages(systemInstruction, parts);

  const body = {
    model,
    messages,
    stream: useStream,
    ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
  };

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error?.message || `Groq HTTP ${res.status}`);
  }

  if (!useStream) {
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || "";
  }

  // Streaming
  let full = "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (raw === "[DONE]") continue;
      try {
        const obj = JSON.parse(raw);
        const chunk = obj?.choices?.[0]?.delta?.content || "";
        if (chunk) {
          full += chunk;
          onChunk(chunk);
        }
      } catch { /* skip */ }
    }
  }
  return full;
}

// ─── OpenRouter ───────────────────────────────────────────────────────────────

async function tryOpenRouter({ systemInstruction, parts, jsonMode, onChunk }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const vision = hasVision(parts);
  const model = vision
    ? (process.env.OPENROUTER_VISION_MODEL || "google/gemini-2.0-flash:free")
    : (process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free");

  const useStream = !!onChunk && !jsonMode;
  const messages = convertPartsToMessages(systemInstruction, parts);

  const body = {
    model,
    messages,
    stream: useStream,
    ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
  };

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.CLIENT_ORIGIN || "http://localhost:5173",
      "X-Title": "Arnab's Assistant",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error?.message || `OpenRouter HTTP ${res.status}`);
  }

  if (!useStream) {
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || "";
  }

  // Streaming
  let full = "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (raw === "[DONE]") continue;
      try {
        const obj = JSON.parse(raw);
        const chunk = obj?.choices?.[0]?.delta?.content || "";
        if (chunk) {
          full += chunk;
          onChunk(chunk);
        }
      } catch { /* skip */ }
    }
  }
  return full;
}

// ─── Public gateway ───────────────────────────────────────────────────────────

/**
 * callGemini({ systemInstruction, parts, jsonMode, onChunk? })
 *
 * Races all configured providers.  First to return a non-empty result wins.
 * If `onChunk` is supplied the winning provider streams tokens into it.
 * Falls back gracefully when providers aren't configured or fail.
 */
export async function callGemini({ systemInstruction, parts, jsonMode = false, onChunk }) {
  const vision = hasVision(parts);

  // Build the list of providers to try in parallel.
  // For vision/JSON calls we skip streaming (not all providers support it).
  const providers = [];

  if (process.env.GEMINI_API_KEY) {
    providers.push(() =>
      tryGemini({ systemInstruction, parts, jsonMode, onChunk }).catch((e) => {
        console.warn("[Gemini] failed:", e.message);
        return null;
      })
    );
  }

  if (process.env.GROQ_API_KEY) {
    providers.push(() =>
      tryGroq({ systemInstruction, parts, jsonMode, onChunk }).catch((e) => {
        console.warn("[Groq] failed:", e.message);
        return null;
      })
    );
  }

  if (process.env.OPENROUTER_API_KEY) {
    providers.push(() =>
      tryOpenRouter({ systemInstruction, parts, jsonMode, onChunk }).catch((e) => {
        console.warn("[OpenRouter] failed:", e.message);
        return null;
      })
    );
  }

  if (providers.length === 0) {
    throw new Error("No AI provider API keys configured. Set GEMINI_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY.");
  }

  // Race: Promise.any resolves with the first non-null result.
  // We wrap each provider so that null (failed) is treated as a rejection for Promise.any.
  const result = await Promise.any(
    providers.map((fn) =>
      fn().then((val) => {
        if (val === null || val === undefined || val === "") {
          throw new Error("empty");
        }
        return val;
      })
    )
  ).catch(() => {
    throw new Error("All AI providers failed. Please check your API keys and try again.");
  });

  return result;
}
