const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";

function endpoint() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not set in .env");
  }
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
}

/**
 * Helper to convert Gemini parts format into OpenAI-compatible Chat Completions messages.
 */
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
      const mime = part.inline_data.mime_type;
      const base64 = part.inline_data.data;
      content.push({
        type: "image_url",
        image_url: {
          url: `data:${mime};base64,${base64}`
        }
      });
    }
  }

  if (content.length === 1 && content[0].type === "text") {
    messages.push({ role: "user", content: content[0].text });
  } else {
    messages.push({ role: "user", content: content });
  }

  return messages;
}

/**
 * Attempt primary Gemini API call.
 */
async function tryGemini({ systemInstruction, parts, jsonMode }) {
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

/**
 * Fallback to Groq API.
 */
async function callGroq({ systemInstruction, parts, jsonMode }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  const hasVision = parts.some(p => p.inline_data);
  const model = hasVision 
    ? (process.env.GROQ_VISION_MODEL || "llama-3.2-11b-vision-preview") 
    : (process.env.GROQ_MODEL || "llama-3.3-70b-versatile");

  const messages = convertPartsToMessages(systemInstruction, parts);
  const body = {
    model,
    messages,
    ...(jsonMode ? { response_format: { type: "json_object" } } : {})
  };

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) {
    const errorMsg = data?.error?.message || "Groq API request failed";
    throw new Error(errorMsg);
  }

  return data?.choices?.[0]?.message?.content || "";
}

/**
 * Fallback to OpenRouter API.
 */
async function callOpenRouter({ systemInstruction, parts, jsonMode }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const hasVision = parts.some(p => p.inline_data);
  const model = hasVision 
    ? (process.env.OPENROUTER_VISION_MODEL || "google/gemini-2.5-flash:free") 
    : (process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free");

  const messages = convertPartsToMessages(systemInstruction, parts);
  const body = {
    model,
    messages,
    ...(jsonMode ? { response_format: { type: "json_object" } } : {})
  };

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "http://localhost:5173",
      "X-Title": "Arnab's Assistant"
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) {
    const errorMsg = data?.error?.message || "OpenRouter API request failed";
    throw new Error(errorMsg);
  }

  return data?.choices?.[0]?.message?.content || "";
}

/**
 * Main completion gateway with Groq and OpenRouter fallbacks.
 */
export async function callGemini({ systemInstruction, parts, jsonMode }) {
  try {
    return await tryGemini({ systemInstruction, parts, jsonMode });
  } catch (geminiError) {
    console.warn("Gemini API failed. Attempting fallback. Error:", geminiError.message);

    // Try Groq fallback
    if (process.env.GROQ_API_KEY) {
      try {
        console.log("Using Groq API fallback...");
        return await callGroq({ systemInstruction, parts, jsonMode });
      } catch (groqError) {
        console.warn("Groq fallback failed. Error:", groqError.message);
      }
    }

    // Try OpenRouter fallback
    if (process.env.OPENROUTER_API_KEY) {
      try {
        console.log("Using OpenRouter API fallback...");
        return await callOpenRouter({ systemInstruction, parts, jsonMode });
      } catch (openRouterError) {
        console.warn("OpenRouter fallback failed. Error:", openRouterError.message);
      }
    }

    // Re-throw original Gemini error if fallbacks were not configured or failed
    throw geminiError;
  }
}
