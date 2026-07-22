import React, { useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Home,
  ClipboardCheck,
  CheckSquare,
  CalendarDays,
  BookOpen,
  GraduationCap,
  Wallet,
  ArrowLeftRight,
  Timer,
  User
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
  { to: "/pomodoro", label: "Timer", icon: Timer },
  { to: "/profile", label: "Profile", icon: User },
];


export default function MobileNav() {
  const location = useLocation();
  const navContainerRef = useRef(null);

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

  return (
    <nav className="mobile-nav" aria-label="Primary">
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
  );
}
