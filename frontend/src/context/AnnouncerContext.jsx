import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const AnnouncerContext = createContext(null);

/**
 * A single polite live region for the whole app.
 *
 * It lives above the routes rather than inside each page on purpose. Screen
 * readers announce *mutations to a live region already present in the document*;
 * a region that shows up with its message already inside it is routinely
 * missed. Seven of the nine data-loading pages return a separate skeleton tree
 * while busy, so a per-page region would be unmounted and remounted at exactly
 * the loading -> loaded transition — the one moment it has to survive. One
 * region mounted for the lifetime of the app sidesteps that.
 *
 * Deliberately separate from ToastContext: toasts are visible UI, and a visible
 * "loading" notice on every page would be noise. This one is for text that only
 * assistive tech consumes.
 */
export function AnnouncerProvider({ children }) {
  const [message, setMessage] = useState("");
  const flip = useRef(false);

  const announce = useCallback((text) => {
    const next = typeof text === "string" ? text.trim() : "";
    if (!next) return;
    // Alternate an invisible zero-width space so that announcing the same string
    // twice in a row still mutates the DOM. Setting identical text is a no-op,
    // and with no mutation there is no announcement — which would silently drop
    // the second "Loading..." when a user retries a failed load.
    flip.current = !flip.current;
    setMessage(flip.current ? `${next}\u200B` : next);
  }, []);

  const value = useMemo(() => ({ announce }), [announce]);

  return (
    <AnnouncerContext.Provider value={value}>
      {children}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {message}
      </div>
    </AnnouncerContext.Provider>
  );
}

export function useAnnounce() {
  const ctx = useContext(AnnouncerContext);
  if (!ctx) throw new Error("useAnnounce must be used within an AnnouncerProvider");
  return ctx.announce;
}

/**
 * Announce a data-loading transition.
 *
 * Pass an empty `readyMessage` to stay quiet on completion — pages that track a
 * load error use that so nothing claims success over their role="alert" banner.
 * The ready message is also suppressed unless the page was actually busy first,
 * so a cached page doesn't report finishing something that never started.
 */
export function useLoadAnnounce(busy, busyMessage, readyMessage) {
  const announce = useAnnounce();
  const wasBusy = useRef(false);

  useEffect(() => {
    if (busy) {
      wasBusy.current = true;
      if (busyMessage) announce(busyMessage);
    } else if (wasBusy.current) {
      wasBusy.current = false;
      if (readyMessage) announce(readyMessage);
    }
  }, [busy, busyMessage, readyMessage, announce]);
}
