import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);

function setFaviconLink(id, rel, href, type, sizes) {
  let link = document.getElementById(id);
  if (link && link.parentNode) {
    link.parentNode.removeChild(link);
  }
  link = document.createElement("link");
  link.id = id;
  link.rel = rel;
  if (type) link.type = type;
  if (sizes) link.sizes = sizes;
  link.href = href;
  document.head.appendChild(link);
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "ink");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);

    // Force instant browser tab favicon refresh by replacing link nodes
    const suffix = theme === "ink" ? "dark" : "light";
    setFaviconLink("favicon-ico", "icon", `/favicon-${suffix}.ico`, "image/x-icon", "any");
    setFaviconLink("favicon-svg", "icon", `/icon-${suffix}.svg`, "image/svg+xml");
    setFaviconLink("favicon-32", "icon", `/icon-${suffix}-32.png`, "image/png", "32x32");
    setFaviconLink("favicon-16", "icon", `/icon-${suffix}-16.png`, "image/png", "16x16");
    setFaviconLink("favicon-apple", "apple-touch-icon", `/apple-touch-icon-${suffix}.png`, null, "180x180");
    setFaviconLink("favicon-512", "icon", `/icon-${suffix}-512.png`, "image/png", "512x512");
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
