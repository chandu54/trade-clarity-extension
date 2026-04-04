import { useEffect } from "react";

/**
 * Custom hook for managing theme state synchronized with the global data model
 */
export function useTheme(currentTheme, onThemeChange) {
  const theme = currentTheme || "light";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    if (onThemeChange) {
      onThemeChange(newTheme);
    }
  };

  return { theme, toggleTheme };
}
