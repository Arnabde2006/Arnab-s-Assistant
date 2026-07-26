import { useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { NAV_ROUTES } from "../components/MobileNav.jsx";

export function useMobileSwipeNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const gestureStartRef = useRef(null);

  useEffect(() => {
    // Helper to check if target is an interactive form element or inside a real horizontally scrollable container
    function isIgnoredTarget(target) {
      if (!target) return true;

      // Ignore interactive form controls, inputs, buttons, links, sliders, modals, or explicitly tagged elements
      if (
        target.closest(
          "input, textarea, select, button, a, .pomo-volume-slider, [data-no-swipe], .modal-overlay, .mobile-sheet, .mobile-drawer-sheet"
        )
      ) {
        return true;
      }

      // Ignore if starting inside an element with active horizontal scrollbar (must exceed 10px overflow to avoid subpixel false positives)
      let scrollParent = target.closest("div, section, article, table");
      while (scrollParent && scrollParent !== document.body) {
        const hasScroll = scrollParent.scrollWidth - scrollParent.clientWidth > 10;
        const overflowStyle = window.getComputedStyle(scrollParent).overflowX;
        if (hasScroll && (overflowStyle === "auto" || overflowStyle === "scroll")) {
          return true;
        }
        scrollParent = scrollParent.parentElement;
      }

      return false;
    }

    // Touch Event Handlers
    function handleTouchStart(e) {
      if (!e.touches || e.touches.length !== 1) return;
      if (isIgnoredTarget(e.touches[0].target)) {
        gestureStartRef.current = null;
        return;
      }

      gestureStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      };
    }

    function handleTouchEnd(e) {
      if (!gestureStartRef.current) return;
      if (!e.changedTouches || e.changedTouches.length === 0) return;

      processSwipe(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    }

    // Mouse Event Handlers (supports desktop mouse drag & browser DevTools mouse gestures)
    function handleMouseDown(e) {
      if (e.button !== 0) return; // Only primary left mouse click
      if (isIgnoredTarget(e.target)) {
        gestureStartRef.current = null;
        return;
      }

      gestureStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        time: Date.now(),
      };
    }

    function handleMouseUp(e) {
      if (!gestureStartRef.current) return;
      processSwipe(e.clientX, e.clientY);
    }

    // Process horizontal swipe logic
    function processSwipe(endX, endY) {
      const start = gestureStartRef.current;
      gestureStartRef.current = null;

      if (!start) return;

      const deltaX = endX - start.x;
      const deltaY = endY - start.y;
      const deltaTime = Date.now() - start.time;

      // Ensure swipe duration is fast (<= 600ms) and distance >= 35px
      if (deltaTime > 600) return;
      if (Math.abs(deltaX) < 35) return;

      // Ensure horizontal direction is dominant (X distance > 1.1 * Y distance)
      if (Math.abs(deltaX) < Math.abs(deltaY) * 1.1) return;

      // Clear any text selection caused by mouse drag
      if (window.getSelection) {
        window.getSelection().removeAllRanges();
      }

      // Find current route index
      const currentPath = location.pathname;
      const currentIndex = NAV_ROUTES.indexOf(currentPath);
      if (currentIndex === -1) return;

      if (deltaX < -35) {
        // Swipe Left (drag right to left) -> Go to Next page
        if (currentIndex < NAV_ROUTES.length - 1) {
          navigate(NAV_ROUTES[currentIndex + 1]);
        }
      } else if (deltaX > 35) {
        // Swipe Right (drag left to right) -> Go to Previous page
        if (currentIndex > 0) {
          navigate(NAV_ROUTES[currentIndex - 1]);
        }
      }
    }

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("mousedown", handleMouseDown, { passive: true });
    window.addEventListener("mouseup", handleMouseUp, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [location.pathname, navigate]);
}
