import { useEffect, useId, useRef } from "react";

/**
 * Accessible modal-dialog behaviour for the app's hand-rolled overlays:
 * focus trap, Escape to close, focus restoration, body scroll lock, and the
 * `role="dialog"` / `aria-modal` / `aria-labelledby` wiring.
 *
 * Takes an explicit `open` flag rather than keying off mount, because three of
 * the four modals are rendered inline inside their page (`{showModal && <div …>}`)
 * — a mount-based hook would fire when the *page* mounts and lock the body
 * scroll for the lifetime of the route.
 *
 * Deliberately does NOT add backdrop-click dismissal. Two of the four modals
 * (the PDF password prompt and the subscription import preview) never had it, and
 * silently adding a way to discard a half-filled form would be a regression
 * dressed up as an accessibility fix. Escape is the new keyboard path; the pages
 * that already close on backdrop click keep their own handler.
 *
 * @param open      whether the dialog is currently rendered
 * @param onClose   called when Escape is pressed
 * @param options.label  use as `aria-label` instead of pointing at a title node
 * @returns dialogProps (spread on the dialog surface) and titleProps (spread on
 *          its heading)
 */

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  "button:not([disabled])",
  "iframe",
  "object",
  "embed",
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
  "audio[controls]",
  "video[controls]",
  "summary",
].join(",");

// Only the topmost dialog reacts to Escape or traps Tab, so closing a nested
// dialog doesn't also tear down the one that opened it.
const dialogStack = [];

// Refcounted for the same reason: an inner dialog closing must not unlock the
// body while an outer one is still open.
let scrollLockCount = 0;
let previousBodyOverflow = "";

// The element to hand focus back to when a dialog closes.
//
// This can't just be `document.activeElement` read inside the open effect: React
// applies `autoFocus` during the commit phase, which is *before* effects run, so
// by then focus may already sit inside the dialog (the PDF password field does
// exactly this) and we'd "restore" focus to a node that is about to be unmounted.
// Tracking focus continuously is the only reliable way to know what was focused
// before the dialog appeared.
let lastExternalFocus = null;

if (typeof document !== "undefined") {
  document.addEventListener(
    "focusin",
    (e) => {
      const el = e.target;
      if (!(el instanceof HTMLElement)) return;
      // Ignore focus landing inside a dialog — we only want the outside world.
      if (el.closest('[role="dialog"]')) return;
      lastExternalFocus = el;
    },
    true
  );
}

function lockScroll() {
  if (scrollLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  scrollLockCount += 1;
}

function unlockScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.body.style.overflow = previousBodyOverflow;
  }
}

function getFocusable(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (el) =>
      // getClientRects() rather than offsetParent, which reports null for
      // position:fixed elements even when they're perfectly visible.
      el.getClientRects().length > 0 && el.getAttribute("aria-hidden") !== "true"
  );
}

export function useDialog(open, onClose, options = {}) {
  const { label } = options;
  const titleId = useId();
  const contentRef = useRef(null);

  // Kept in a ref so the keydown listener stays registered for as long as the
  // dialog is open, instead of being torn down and rebuilt every time the parent
  // re-renders with a fresh inline arrow function.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;

    const token = {};
    dialogStack.push(token);
    lockScroll();

    const content = contentRef.current;
    // Snapshot now: by the time we close, focus has moved and the tracker will
    // be pointing at something inside this dialog's subtree.
    const trigger =
      content && content.contains(document.activeElement)
        ? lastExternalFocus
        : document.activeElement || lastExternalFocus;

    // Move focus in — but only if nothing inside has claimed it already. The
    // password field carries `autoFocus` and the todo editor focuses its own
    // input, and both are better targets than the container.
    if (content && !content.contains(document.activeElement)) {
      const [firstFocusable] = getFocusable(content);
      (firstFocusable || content).focus();
    }

    function handleKeyDown(e) {
      if (dialogStack[dialogStack.length - 1] !== token) return;

      if (e.key === "Escape") {
        // No preventDefault: a native <select> dropdown swallows Escape to close
        // itself, and this listener sits on the bubble phase precisely so inner
        // widgets get first refusal. stopPropagation keeps window-level handlers
        // (Pomodoro's shortcut listener) from firing a second time.
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }

      if (e.key !== "Tab") return;

      const focusable = getFocusable(contentRef.current);
      if (focusable.length === 0) {
        e.preventDefault();
        contentRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (!contentRef.current?.contains(active)) {
        // Focus escaped the dialog (browser chrome, a stray programmatic blur);
        // pull it back rather than letting Tab wander the page behind it.
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const i = dialogStack.indexOf(token);
      if (i !== -1) dialogStack.splice(i, 1);
      unlockScroll();
      // Send focus back where it came from, so the user isn't dumped at the top
      // of the document. isConnected guards the case where the trigger was
      // removed while the dialog was open (a deleted row, say).
      if (trigger && trigger.isConnected && typeof trigger.focus === "function") {
        trigger.focus();
      }
    };
  }, [open]);

  return {
    dialogProps: {
      ref: contentRef,
      role: "dialog",
      "aria-modal": "true",
      tabIndex: -1,
      ...(label ? { "aria-label": label } : { "aria-labelledby": titleId }),
    },
    titleProps: { id: titleId },
  };
}

export default useDialog;
