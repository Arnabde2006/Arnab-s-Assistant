import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "ink");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);

    // Dynamic favicon switcher matching active theme state (ink=dark, parchment=light)
    const suffix = theme === "ink" ? "dark" : "light";

    const ico = document.getElementById("favicon-ico");
    if (ico) ico.href = `/favicon-${suffix}.ico`;

    const svg = document.getElementById("favicon-svg");
    if (svg) svg.href = `/icon-${suffix}.svg`;

    const f32 = document.getElementById("favicon-32");
    if (f32) f32.href = `/icon-${suffix}-32.png`;

    const f16 = document.getElementById("favicon-16");
    if (f16) f16.href = `/icon-${suffix}-16.png`;

    const app = document.getElementById("favicon-apple");
    if (app) app.href = `/apple-touch-icon-${suffix}.png`;

    const f512 = document.getElementById("favicon-512");
    if (f512) f512.href = `/icon-${suffix}-512.png`;
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
