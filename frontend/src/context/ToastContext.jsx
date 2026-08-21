import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const ToastContext = createContext(null);

let idSeq = 0;

const DEFAULT_DURATION = 4500;
// Errors linger longer — they carry information the user may need to act on.
const ERROR_DURATION = 7000;

/**
 * App-wide notification surface.
 *
 * Exists so that every page has somewhere to report a failure. Before this,
 * most pages had no error state at all, so a rejected request simply did
 * nothing visible. Prefer `useAsyncAction()` for mutations — it wires errors
 * in here automatically — and reach for `useToast()` directly only for
 * one-off messages.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const handle = timers.current.get(id);
    if (handle) {
      clearTimeout(handle);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (message, type = "info", duration) => {
      const text = typeof message === "string" ? message.trim() : String(message ?? "");
      if (!text) return null;

      const id = ++idSeq;
      const ttl = duration ?? (type === "error" ? ERROR_DURATION : DEFAULT_DURATION);

      setToasts((list) => {
        // Collapse an identical consecutive message instead of stacking
        // duplicates — a retry loop shouldn't bury the screen in toasts.
        const last = list[list.length - 1];
        if (last && last.message === text && last.type === type) return list;
        return [...list, { id, message: text, type }];
      });

      if (ttl > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), ttl)
        );
      }
      return id;
    },
    [dismiss]
  );

  // Clear any outstanding timers if the provider itself goes away.
  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const handle of map.values()) clearTimeout(handle);
      map.clear();
    };
  }, []);

  const value = useMemo(
    () => ({
      toasts,
      dismiss,
      notify: push,
      success: (message, duration) => push(message, "success", duration),
      error: (message, duration) => push(message, "error", duration),
      info: (message, duration) => push(message, "info", duration),
    }),
    [toasts, push, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport />
    </ToastContext.Provider>
  );
}

/**
 * Renders the live toast stack. Kept in this file so it can sit inside the
 * provider without callers having to mount it themselves.
 *
 * Accessibility: the container is a polite live region so success/info
 * messages are announced without interrupting, while individual error toasts
 * carry role="alert" so failures are announced immediately.
 */
function ToastViewport() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-viewport" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast-${toast.type}`}
          {...(toast.type === "error" ? { role: "alert" } : {})}
        >
          <span className="toast-message">{toast.message}</span>
          <button
            type="button"
            className="toast-dismiss"
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss notification"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside a <ToastProvider>");
  }
  return ctx;
}
