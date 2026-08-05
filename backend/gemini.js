/**
 * AI gateway — tries providers in sequence (Groq → Gemini → OpenRouter).
 * Vision-capable and text-only models are strictly separated so image payloads
 * are never sent to a text-only model.
 *
 * Model lists are configurable via environment variables — update .env when
 * providers retire old models without needing a code change.
 *
 * For streaming (SSE) the caller passes `onChunk(text)` — each provider
 * that supports streaming will call it incrementally. For non-streaming
 * callers (grade-card / exam-timetable JSON extraction) omit `onChunk`.
 */

import { pdfToImages } from "./lib/pdfToImages.js";

// ─── Model config (override via .env) ────────────────────────────────────────
//
// Comma-separated lists; first entry is tried first.
// GEMINI: all listed models support vision natively.
// GROQ_VISION: vision-capable Groq models only — never receives text-only prompts.
// GROQ_TEXT:   text-only Groq models — NEVER receives image content.
// OPENROUTER_VISION / OPENROUTER_TEXT: same split for OpenRouter.

function envList(key, defaults) {
  const val = process.env[key];
  return val ? val.split(",").map((s) => s.trim()).filter(Boolean) : defaults;
}

const GEMINI_MODELS = envList("GEMINI_MODELS", [
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
]);

const GROQ_VISION_MODELS = envList("GROQ_VISION_MODELS", [
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
  "qwen/qwen3.6-27b",
]);

const GROQ_TEXT_MODELS = envList("GROQ_TEXT_MODELS", [
  "llama-3.3-70b-versatile",
]);

const OPENROUTER_VISION_MODELS = envList("OPENROUTER_VISION_MODELS", [
  "google/gemini-3.6-flash",
  "google/gemini-3.5-flash-lite",
]);

const OPENROUTER_TEXT_MODELS = envList("OPENROUTER_TEXT_MODELS", [
  "google/gemini-3.6-flash",
  "meta-llama/llama-3.3-70b-instruct",
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasVision(parts) {
  return parts.some((p) => p.inline_data || p.inlineData);
}

function hasPdf(parts) {
  return parts.some((p) => {
    const inline = p.inline_data || p.inlineData;
    const mime = (inline?.mime_type || inline?.mimeType || "").toLowerCase();
    return mime.includes("pdf");
  });
}

function cleanJsonResponse(str) {
  if (!str) return str;
  let cleaned = str.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }
  return cleaned;
}

/**
 * Converts the Gemini-style `parts` array to an OpenAI-compatible messages array.
 * Images in `parts` are emitted as `image_url` objects.
 */
function convertPartsToMessages(systemInstruction, parts, jsonMode = false) {
  const messages = [];

  let sys = systemInstruction || "";
  if (jsonMode) {
    const jsonPrompt =
      "IMPORTANT: Response must be a valid JSON object. Do NOT wrap in markdown or code blocks. Output raw JSON only.";
    sys = sys ? `${sys}\n\n${jsonPrompt}` : jsonPrompt;
  }

  if (sys) {
    messages.push({ role: "system", content: sys });
  }

  const content = [];
  for (const part of parts) {
    if (part.text) {
      content.push({ type: "text", text: part.text });
    } else if (part.inline_data || part.inlineData) {
      const inline = part.inline_data || part.inlineData;
      const mime = inline.mime_type || inline.mimeType;
      const base64 = inline.data;
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

/**
 * Replaces any PDF part with rendered page images so vision APIs can read it.
 * Returns a new parts array safe for OpenAI-style vision endpoints.
 */
async function convertPdfPartsToImages(parts) {
  const pdfPart = parts.find((p) => {
    const inline = p.inline_data || p.inlineData;
    const mime = (inline?.mime_type || inline?.mimeType || "").toLowerCase();
    return mime.includes("pdf");
  });

  if (!pdfPart) return parts;

  const inline = pdfPart.inline_data || pdfPart.inlineData;
  const images = await pdfToImages(inline.data, 2); // max 2 pages → stays within free TPM

  if (images.length === 0) {
    throw new Error("Could not convert PDF to images — check that pdf-to-img is installed");
  }

  return [
    ...parts.filter((p) => p !== pdfPart),
    ...images.map((dataUrl) => ({
      inlineData: {
        mimeType: "image/png",
        data: dataUrl.replace(/^data:image\/png;base64,/, ""),
      },
    })),
  ];
}

// ─── Gemini ───────────────────────────────────────────────────────────────────
// Gemini natively supports PDF inline data — no conversion needed.

function geminiEndpoint(model, stream = false) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const method = stream ? "streamGenerateContent" : "generateContent";
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}?key=${key}${stream ? "&alt=sse" : ""}`;
}

async function tryGemini({ systemInstruction, parts, jsonMode, onChunk }) {
  const normalizedParts = parts.map((p) => {
    if (p.inline_data) {
      return {
        inlineData: {
          mimeType: p.inline_data.mime_type || p.inline_data.mimeType,
          data: p.inline_data.data,
        },
      };
    }
    if (p.inlineData) {
      return {
        inlineData: {
          mimeType: p.inlineData.mime_type || p.inlineData.mimeType,
          data: p.inlineData.data,
        },
      };
    }
    return p;
  });

  const body = {
    contents: [{ role: "user", parts: normalizedParts }],
    ...(systemInstruction
      ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
      : {}),
    ...(jsonMode ? { generationConfig: { responseMimeType: "application/json" } } : {}),
  };

  const useStream = !!onChunk && !jsonMode;
  let lastError = null;

  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(geminiEndpoint(model, useStream), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const errMsg = data?.error?.message || `Gemini HTTP ${res.status}`;
        lastError = new Error(errMsg);
        // Treat quota, rate-limit, and 404 (retired model) as "try next"
        const isRetryable =
          res.status === 429 ||
          res.status === 404 ||
          errMsg.toLowerCase().includes("quota") ||
          errMsg.toLowerCase().includes("rate") ||
          errMsg.toLowerCase().includes("not found");
        if (isRetryable) {
          console.warn(`[Gemini] Model ${model} unavailable (${res.status}). Trying next...`);
          continue;
        }
        throw lastError;
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
        buffer = lines.pop();
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
    } catch (err) {
      lastError = err;
      const isRetryable =
        err.message?.toLowerCase().includes("quota") ||
        err.message?.toLowerCase().includes("rate") ||
        err.message?.toLowerCase().includes("not found");
      if (isRetryable) continue;
      throw err;
    }
  }

  throw lastError || new Error("All Gemini models exhausted");
}

// ─── Groq ─────────────────────────────────────────────────────────────────────
// PDF inputs are converted to images first. Text-only models are never handed
// image content.

async function tryGroq({ systemInstruction, parts, jsonMode, onChunk }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  let processedParts = parts;

  // PDF → images before checking `hasVision`, so the vision branch fires correctly
  if (hasPdf(parts)) {
    console.log("[Groq] PDF detected — converting pages to images...");
    processedParts = await convertPdfPartsToImages(parts);
  }

  const isVision = hasVision(processedParts);

  // CRITICAL: text-only models must NEVER receive image content
  const models = isVision ? GROQ_VISION_MODELS : GROQ_TEXT_MODELS;

  if (models.length === 0) {
    throw new Error("No Groq models configured for this request type");
  }

  const messages = convertPartsToMessages(systemInstruction, processedParts, jsonMode);

  let lastErr = null;
  for (const model of models) {
    try {
      const useStream = !!onChunk && !jsonMode && !isVision;
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
        const raw = data?.choices?.[0]?.message?.content || "";
        return jsonMode ? cleanJsonResponse(raw) : raw;
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
    } catch (err) {
      lastErr = err;
      console.warn(`[Groq] Model ${model} failed: ${err.message}. Trying next...`);
    }
  }

  throw lastErr || new Error("All Groq models failed");
}

// ─── OpenRouter ───────────────────────────────────────────────────────────────
// PDF inputs are converted to images first.
// Vision and text-only model lists are separate.
// max_tokens is capped at 2048 to stay within free-tier credit limits.

async function tryOpenRouter({ systemInstruction, parts, jsonMode, onChunk }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  let processedParts = parts;

  if (hasPdf(parts)) {
    console.log("[OpenRouter] PDF detected — converting pages to images...");
    processedParts = await convertPdfPartsToImages(parts);
  }

  const isVision = hasVision(processedParts);
  const models = isVision ? OPENROUTER_VISION_MODELS : OPENROUTER_TEXT_MODELS;

  if (models.length === 0) {
    throw new Error("No OpenRouter models configured for this request type");
  }

  const messages = convertPartsToMessages(systemInstruction, processedParts, jsonMode);

  let lastErr = null;
  for (const model of models) {
    try {
      const useStream = !!onChunk && !jsonMode;
      const body = {
        model,
        messages,
        max_tokens: 2048, // capped — free tier can't afford 65536
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
        const raw = data?.choices?.[0]?.message?.content || "";
        return jsonMode ? cleanJsonResponse(raw) : raw;
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
    } catch (err) {
      lastErr = err;
      console.warn(`[OpenRouter] Model ${model} failed: ${err.message}. Trying next...`);
    }
  }

  throw lastErr || new Error("All OpenRouter models failed");
}

// ─── Public gateway ───────────────────────────────────────────────────────────

/**
 * callGemini({ systemInstruction, parts, jsonMode, onChunk? })
 *
 * Tries providers in sequence: Groq → Gemini → OpenRouter.
 * Each provider is given the full model fallback list before moving to the next provider.
 * Vision content is never routed to text-only models.
 */
export async function callGemini({ systemInstruction, parts, jsonMode = false, onChunk }) {
  const providers = [];

  // Groq first — free tier, fast, no usage cost, now supports PDF-via-images
  if (process.env.GROQ_API_KEY) {
    providers.push(() =>
      tryGroq({ systemInstruction, parts, jsonMode, onChunk }).catch((e) => {
        console.warn("[Groq] failed:", e.message);
        return null;
      })
    );
  }

  // Gemini second — supports PDF natively, may be rate-limited on free key
  if (process.env.GEMINI_API_KEY) {
    providers.push(() =>
      tryGemini({ systemInstruction, parts, jsonMode, onChunk }).catch((e) => {
        console.warn("[Gemini] failed:", e.message);
        return null;
      })
    );
  }

  // OpenRouter last — paid credits, use as last resort
  if (process.env.OPENROUTER_API_KEY) {
    providers.push(() =>
      tryOpenRouter({ systemInstruction, parts, jsonMode, onChunk }).catch((e) => {
        console.warn("[OpenRouter] failed:", e.message);
        return null;
      })
    );
  }

  if (providers.length === 0) {
    throw new Error(
      "No AI provider API keys configured. Set GEMINI_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY."
    );
  }

  // Sequential: try each provider in order, stop at first success
  for (const provider of providers) {
    const result = await provider();
    if (result !== null && result !== undefined && result !== "") {
      return result;
    }
  }

  throw new Error("All AI providers failed. Please check your API keys and try again.");
}
