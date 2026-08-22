import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import useDialog from "../hooks/useDialog.js";

/**
 * A promise-returning replacement for `window.confirm`.
 *
 * The native dialog was used in five places. It is unstyleable, it blocks the
 * whole event loop, it renders outside the app's theme, and on mobile Safari a
 * page can have its dialogs suppressed entirely -- in which case `confirm()`
 * returns false and the user's action silently does nothing.
 *
 * The API is promise-based rather than "hold state and render a component" so
 * that the call sites stay one line:
 *
 *     if (!(await confirm({ title: "Delete?", message: "..." }))) return;
 *
 * Only the `await` distinguishes it from the code it replaced. The alternative
 * would have put ~15 lines of state and markup in each of the five callers.
 */

// Profile and ViewOnlyLinkCard both offer this action, so the wording lives in
// one place rather than being kept in sync by hand.
export const CONFIRM_REGENERATE_VIEW_LINK = {
  title: "Regenerate view-only link?",
  message:
    "This invalidates your current view-only link. Anyone you have shared it with will lose access.",
  confirmLabel: "Regenerate",
};

const ConfirmContext = createContext(null);

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used inside a <ConfirmProvider>");
  return confirm;
}

export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const resolveRef = useRef(null);

  const settle = useCallback((answer) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setRequest(null);
    if (resolve) resolve(answer);
  }, []);

  const confirm = useCallback(
    (options) => {
      // Resolve any dialog already waiting instead of dropping its promise on
      // the floor. An abandoned promise never settles, so the awaiting caller
      // would stop dead -- including its `finally`, which is usually what
      // clears a loading flag.
      if (resolveRef.current) settle(false);
      return new Promise((resolve) => {
        resolveRef.current = resolve;
        setRequest(typeof options === "string" ? { message: options } : options);
      });
    },
    [settle]
  );

  const cancel = useCallback(() => settle(false), [settle]);

  // Called unconditionally: the hook takes `open` as an argument precisely so
  // it can be inert while nothing is being confirmed.
  const dialog = useDialog(Boolean(request), cancel);

  const {
    title = "Are you sure?",
    message = "",
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
  } = request || {};

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.7)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            className="card"
            {...dialog.dialogProps}
            style={{
              width: "100%",
              maxWidth: 400,
              padding: 24,
              borderRadius: "var(--radius-md)",
              border: "1.5px solid var(--absent)",
              boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <AlertTriangle size={20} style={{ color: "var(--absent)", flexShrink: 0 }} aria-hidden="true" />
              <h3 {...dialog.titleProps} style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                {title}
              </h3>
            </div>

            {message && (
              <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
                {message}
              </p>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              {/* Cancel takes initial focus: every current caller is destructive,
                  and Enter on an unread dialog should not be the one that fires. */}
              <button type="button" className="btn-ghost" onClick={cancel} autoFocus>
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => settle(true)}
                style={{
                  padding: "8px 18px",
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  background: "var(--absent)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export default ConfirmContext;
