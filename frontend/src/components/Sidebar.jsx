import { NavLink } from "react-router-dom";
import ThemeToggle from "./ThemeToggle.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const links = [
  { to: "/", label: "Dashboard", icon: "◆" },
  { to: "/attendance", label: "Attendance", icon: "◉" },
  { to: "/todos", label: "To‑do & Calendar", icon: "☰" },
  { to: "/timetable", label: "Timetable", icon: "▦" },
  { to: "/exams", label: "Exam timetable", icon: "✎" },
  { to: "/grades", label: "Grades", icon: "▲" },
  { to: "/pomodoro", label: "Focus timer", icon: "◷" },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <div className="sidebar">
      <div className="brand">
        Arnab's Assistant<span className="dot">.</span>
      </div>
      <div className="brand-tagline">Your personal college companion</div>
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.to === "/"}
          className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
        >
          <span>{link.icon}</span>
          {link.label}
        </NavLink>
      ))}
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
        <ThemeToggle />
        {user && (
          <button className="btn-ghost btn" onClick={logout} style={{ fontSize: 13 }}>
            Log out ({user.name.split(" ")[0]})
          </button>
        )}
      </div>
    </div>
  );
}
