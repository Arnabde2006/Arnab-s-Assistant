import { useCallback, useRef, useState } from "react";
import { useToast } from "../context/ToastContext.jsx";
import { isSessionExpiredError } from "../api/client.js";

/**
 * Wraps an async action (typically an api.* mutation) so that:
 *
 *  - a rejection is surfaced to the user as a toast instead of vanishing into
 *    an unhandled promise rejection,
 *  - `pending` is exposed so callers can disable the triggering control,
 *  - re-entrant calls are dropped, so a double-tap can't fire the same
 *    mutation twice.
 *
 * Returns `{ ok, result }` on success and `{ ok: false, error }` on failure,
 * so callers can decide whether to close a modal / reset a form rather than
 * doing it unconditionally.
 *
 * Usage:
 *   const { run, pending } = useAsyncAction();
 *   await run(() => api.post("/debts", body), {
 *     errorMessage: "Couldn't add that debt",
 *     successMessage: "Debt added",
 *   });
 */
export function useAsyncAction() {
  const { error: toastError, success: toastSuccess } = useToast();
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  const run = useCallback(
    async (fn, { errorMessage, successMessage } = {}) => {
      if (inFlight.current) return { ok: false, skipped: true };

      inFlight.current = true;
      setPending(true);
      try {
        const result = await fn();
        if (successMessage) toastSuccess(successMessage);
        return { ok: true, result };
      } catch (err) {
        // An expired session already triggers a global logout + notice in the
        // api client; a second toast here would just be noise.
        if (!isSessionExpiredError(err)) {
          const detail = err?.message || "Something went wrong";
          toastError(errorMessage ? `${errorMessage} — ${detail}` : detail);
        }
        return { ok: false, error: err };
      } finally {
        inFlight.current = false;
        setPending(false);
      }
    },
    [toastError, toastSuccess]
  );

  return { run, pending };
}
