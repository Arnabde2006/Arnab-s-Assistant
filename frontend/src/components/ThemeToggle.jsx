import { useTheme } from "../context/ThemeContext.jsx";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="theme-toggle" role="group" aria-label="Theme switcher">
      <button
        className={theme === "ink" ? "active" : ""}
        onClick={() => setTheme("ink")}
        title="Ink (dark)"
        aria-label="Ink theme"
      >
        ●
      </button>
      <button
        className={theme === "parchment" ? "active" : ""}
        onClick={() => setTheme("parchment")}
        title="Parchment (light)"
        aria-label="Parchment theme"
      >
        ○
      </button>
    </div>
  );
}
