import { useEffect, useState } from "react";

type Theme = "dark" | "light";

const THEME_KEY = "dawaa_theme";
const LEGACY_PALETTE_KEY = "dawaa_palette";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem(THEME_KEY) as Theme) || "dark";
  });

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    localStorage.removeItem(LEGACY_PALETTE_KEY);
    document.documentElement.classList.toggle("light-mode", theme === "light");
    document.documentElement.classList.toggle("dark-mode", theme === "dark");
    document.documentElement.removeAttribute("data-palette");
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return { theme, setTheme, toggleTheme };
}
