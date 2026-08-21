const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Hard cap on a normal request. Without this a hung connection leaves the UI
// waiting forever — a spinner that never resolves, or a button that never
// re-enables.
const REQUEST_TIMEOUT_MS = 20000;
// Streaming responses are long-lived by nature, so they're bounded by the gap
// between chunks rather than total duration (mirrors the backend's
// AI_STREAM_IDLE_TIMEOUT_MS).
const STREAM_IDLE_TIMEOUT_MS = 30000;

/**
 * Endpoints where a 401 means "these credentials are wrong", NOT "your session
 * expired" — so they must never trigger a global logout:
 *
 *   POST /auth/login  → wrong email/password
 *   PUT  /auth/me     → wrong `currentPassword` when changing password
 *   GET  /auth/me     → mount-time token validation, which AuthContext already
 *                       handles quietly by falling back to the login screen
 */
const CREDENTIAL_PATHS = ["/auth/login", "/auth/register", "/auth/me"];

function isCredentialPath(path) {
  return CREDENTIAL_PATHS.some((p) => path === p || path.startsWith(`${p}?`));
}

const SESSION_EXPIRED = "SESSION_EXPIRED";

/** True if `err` came from a 401 that means the session is no longer valid. */
export function isSessionExpiredError(err) {
  return err?.code === SESSION_EXPIRED;
}

let onUnauthorized = null;

/**
 * Register the callback fired when a request fails because the session is no
 * longer valid. AuthContext uses this to clear its state so the router sends
 * the user back to the login screen.
 */
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

function authHeaders(extra) {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extra || {}),
  };
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: authHeaders(options.headers),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("The server took too long to respond. Check your connection and try again.");
    }
    // fetch only rejects on network-level failure, so this is genuinely offline
    // or an unreachable server — worth saying so plainly.
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401 && !isCredentialPath(path)) {
      const err = new Error("Your session has expired. Please sign in again.");
      err.code = SESSION_EXPIRED;
      err.status = 401;
      onUnauthorized?.();
      throw err;
    }

    // Fall back to the status when the body carried no message — a bare
    // "Something went wrong" tells the user nothing about what to do next.
    const err = new Error(
      data.error || `Request failed (${res.status} ${res.statusText || "error"})`
    );
    err.status = res.status;
    throw err;
  }
  return data;
}

/**
 * POST to a streaming SSE endpoint.
 * Calls onChunk(text) for each delta, onDone(fullReply) when complete.
 *
 * Returns a `cancel()` function so callers can abort the stream (e.g. on
 * unmount or when the user navigates away) instead of leaving the reader
 * running in the background.
 */
function postStream(path, body, { onChunk, onDone, onError } = {}) {
  const controller = new AbortController();
  let cancelledByCaller = false;
  let idleTimer = null;

  const clearIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
  };
  const touchIdle = () => {
    clearIdle();
    idleTimer = setTimeout(() => controller.abort(), STREAM_IDLE_TIMEOUT_MS);
  };

  const promise = (async () => {
    try {
      touchIdle();
      const res = await fetch(`${API_URL}${path}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 401 && !isCredentialPath(path)) {
          const err = new Error("Your session has expired. Please sign in again.");
          err.code = SESSION_EXPIRED;
          onUnauthorized?.();
          throw err;
        }
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      if (!res.body) {
        throw new Error("Streaming isn't supported in this browser.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        touchIdle();
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop(); // keep partial last line

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          try {
            const obj = JSON.parse(raw);
            if (obj.error) {
              onError?.(new Error(obj.error));
              return;
            }
            if (obj.delta) onChunk?.(obj.delta);
            if (obj.done) onDone?.(obj.reply ?? "");
          } catch { /* ignore malformed lines */ }
        }
      }
    } catch (err) {
      if (err.name === "AbortError") {
        // Either the idle timeout fired or the caller cancelled. Only the
        // former is worth reporting; a deliberate cancel should stay silent.
        if (!cancelledByCaller) {
          onError?.(new Error("The response stalled. Please try again."));
        }
        return;
      }
      onError?.(err);
    } finally {
      clearIdle();
    }
  })();

  promise.cancel = () => {
    cancelledByCaller = true;
    controller.abort();
  };
  return promise;
}

export const api = {
  get: (path) => request(path, { method: "GET" }),
  post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: "PUT", body: JSON.stringify(body) }),
  del: (path, body) => request(path, { method: "DELETE", ...(body ? { body: JSON.stringify(body) } : {}) }),
  postStream,
};
