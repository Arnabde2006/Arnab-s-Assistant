import React, { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Home,
  ClipboardCheck,
  CheckSquare,
  CreditCard,
  Award,
  CalendarDays,
  BookOpen,
  GraduationCap,
  Wallet,
  ArrowLeftRight,
  Timer,
  User,
  ChevronUp,
  X
} from "lucide-react";

export const NAV_ROUTES = [
  "/",
  "/attendance",
  "/todos",
  "/timetable",
  "/exams",
  "/grades",
  "/finance",
  "/debts",
  "/subscriptions",
  "/nptel",
  "/pomodoro",
  "/profile",
];

const links = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/attendance", label: "Attend.", icon: ClipboardCheck },
  { to: "/todos", label: "Calendar", icon: CheckSquare },
  { to: "/timetable", label: "Classes", icon: CalendarDays },
  { to: "/exams", label: "Exams", icon: BookOpen },
  { to: "/grades", label: "Grades", icon: GraduationCap },
  { to: "/finance", label: "Finance", icon: Wallet },
  { to: "/debts", label: "Debts", icon: ArrowLeftRight },
  { to: "/subscriptions", label: "Subs", icon: CreditCard },
  { to: "/nptel", label: "NPTEL", icon: Award },
  { to: "/pomodoro", label: "Timer", icon: Timer },
  { to: "/profile", label: "Profile", icon: User },
];

export default function MobileNav() {
  const location = useLocation();
  const navContainerRef = useRef(null);
  const touchStartY = useRef(null);
  const touchStartX = useRef(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [navStyle, setNavStyle] = useState(() => localStorage.getItem("mobileNavStyle") || "bottom_bar");

  useEffect(() => {
    const handleStyleChange = () => {
      setNavStyle(localStorage.getItem("mobileNavStyle") || "bottom_bar");
    };
    window.addEventListener("mobileNavStyleChange", handleStyleChange);
    return () => window.removeEventListener("mobileNavStyleChange", handleStyleChange);
  }, []);

  // Auto-scroll horizontal bar to active item on route change
  useEffect(() => {
    if (!navContainerRef.current) return;
    const activeItem = navContainerRef.current.querySelector(".mobile-nav-item.active");
    if (activeItem) {
      activeItem.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [location.pathname]);

  if (navStyle === "hamburger_drawer") {
    return null; // Bottom bar disabled when 3-line top-left menu drawer mode is active
  }

  // Touch gesture listeners for Swipe Up / Swipe Down
  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartY.current === null || touchStartX.current === null) return;
    const touchEndY = e.changedTouches[0].clientY;
    const touchEndX = e.changedTouches[0].clientX;

    const deltaY = touchStartY.current - touchEndY;
    const deltaX = Math.abs(touchStartX.current - touchEndX);

    // If vertical movement is greater than horizontal movement & > 35px
    if (Math.abs(deltaY) > deltaX && Math.abs(deltaY) > 35) {
      if (deltaY > 0 && !isExpanded) {
        // Swiped UP -> Expand grid sheet
        setIsExpanded(true);
      } else if (deltaY < 0 && isExpanded) {
        // Swiped DOWN -> Collapse sheet
        setIsExpanded(false);
      }
    }

    touchStartY.current = null;
    touchStartX.current = null;
  };

  return (
    <>
      {/* Mobile Bottom Bar */}
      <nav
        className="mobile-nav"
        aria-label="Primary"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Swipe-Up Drag Handle Pill */}
        <div
          className="mobile-nav-drag-handle"
          onClick={() => setIsExpanded(!isExpanded)}
          title="Swipe up or tap for all apps grid"
        />

        <div className="mobile-nav-inner" ref={navContainerRef}>
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => "mobile-nav-item" + (isActive ? " active" : "")}
              >
                <span className="icon" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={18} />
                </span>
                {link.label}
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Expanded Grid Sheet Overlay (Opened by Swipe Up or Drag Handle Tap) */}
      {isExpanded && (
        <>
          <div
            className="mobile-nav-backdrop"
            onClick={() => setIsExpanded(false)}
          />
          <div className="mobile-nav-sheet">
            <div className="mobile-nav-sheet-header">
              <div className="mobile-nav-sheet-pill" onClick={() => setIsExpanded(false)} />
              <div className="mobile-nav-sheet-title-row">
                <span className="mobile-nav-sheet-title">All Apps &amp; Features</span>
                <button
                  className="mobile-nav-sheet-close"
                  onClick={() => setIsExpanded(false)}
                  aria-label="Close sheet"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="mobile-nav-grid">
              {links.map((link) => {
                const Icon = link.icon;
                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.end}
                    onClick={() => setIsExpanded(false)}
                    className={({ isActive }) => "mobile-nav-grid-item" + (isActive ? " active" : "")}
                  >
                    <div className="mobile-nav-grid-icon-box">
                      <Icon size={20} />
                    </div>
                    <span>{link.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}
