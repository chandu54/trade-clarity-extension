import { useState, useEffect } from "react";

/**
 * Custom hook for managing theme state with localStorage persistence
 */
export function useTheme() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "light",
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  };

  return { theme, setTheme, toggleTheme };
}
