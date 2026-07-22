import { useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { NAV_ROUTES } from "../components/MobileNav.jsx";

export function useMobileSwipeNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const touchStartRef = useRef(null);

  useEffect(() => {
    // Check if on mobile viewport (<= 768px) or touch device
    const isMobile = window.innerWidth <= 768 || "ontouchstart" in window;
    if (!isMobile) return;

    function handleTouchStart(e) {
      if (!e.touches || e.touches.length !== 1) return;
      const touch = e.touches[0];

      // Ignore touches starting inside inputs, textareas, select, buttons, sliders, or no-swipe containers
      const target = touch.target;
      if (
        target.closest("input, textarea, select, button, .pomo-volume-slider, [data-no-swipe]")
      ) {
        touchStartRef.current = null;
        return;
      }

      // Ignore if starting inside an element with active horizontal overflow scrolling
      let scrollParent = target.closest("div, section, article");
      while (scrollParent && scrollParent !== document.body) {
        if (
          scrollParent.scrollWidth > scrollParent.clientWidth &&
          (window.getComputedStyle(scrollParent).overflowX === "auto" ||
            window.getComputedStyle(scrollParent).overflowX === "scroll")
        ) {
          touchStartRef.current = null;
          return;
        }
        scrollParent = scrollParent.parentElement;
      }

      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
    }

    function handleTouchEnd(e) {
      if (!touchStartRef.current) return;
      if (!e.changedTouches || e.changedTouches.length === 0) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;
      const deltaTime = Date.now() - touchStartRef.current.time;

      touchStartRef.current = null;

      // Ensure swipe duration is within 500ms and horizontal distance is at least 50px
      if (deltaTime > 500) return;
      if (Math.abs(deltaX) < 50) return;

      // Ensure horizontal swipe is dominant (X distance > 1.4 * Y distance)
      if (Math.abs(deltaX) < Math.abs(deltaY) * 1.4) return;

      // Find current route index
      const currentPath = location.pathname;
      const currentIndex = NAV_ROUTES.indexOf(currentPath);
      if (currentIndex === -1) return;

      if (deltaX < -50) {
        // Swipe Left (finger moves right to left) -> Go to Next page
        if (currentIndex < NAV_ROUTES.length - 1) {
          navigate(NAV_ROUTES[currentIndex + 1]);
        }
      } else if (deltaX > 50) {
        // Swipe Right (finger moves left to right) -> Go to Previous page
        if (currentIndex > 0) {
          navigate(NAV_ROUTES[currentIndex - 1]);
        }
      }
    }

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [location.pathname, navigate]);
}
