import { createContext, useCallback, useContext, useEffect, useState } from "react";

// Theme: 'light' | 'dark' | 'system' (follows OS preference).
// Persisted in localStorage under 'varc_theme'.

const THEME_KEY = "varc_theme";
const ThemeContext = createContext(null);

function getSystemTheme() {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  const root = document.documentElement;
  const resolved = theme === "system" ? getSystemTheme() : theme;
  // Graspr is a dark-only editorial design — always render the dark palette
  // regardless of the requested/system theme. (The toggle is kept for a
  // possible future light mode but currently has no visual effect.)
  void resolved;
  root.classList.add("dark");
  root.style.colorScheme = "dark";
}

export function ThemeProvider({ children }) {
  // Hydrate from localStorage; default to 'system' so first-time visitors get
  // their OS preference (recommended UX from the planning grilling).
  const [theme, setThemeState] = useState(() => {
    if (typeof window === "undefined") return "system";
    return localStorage.getItem(THEME_KEY) || "system";
  });

  // Apply on every theme change and on mount.
  useEffect(() => {
    applyTheme(theme);
    if (theme === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // While in 'system' mode, follow OS toggles live.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback((t) => setThemeState(t), []);

  // Convenience: cycle light -> dark -> system -> light
  const cycleTheme = useCallback(() => {
    setThemeState((t) => (t === "light" ? "dark" : t === "dark" ? "system" : "light"));
  }, []);

  const resolved = theme === "system" ? getSystemTheme() : theme;

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
