import { createContext, createElement, useCallback, useContext, useEffect, useState } from "react";

const ThemeModeContext = createContext(null);

function readStoredTheme() {
  if (typeof window === "undefined") return "light";

  try {
    const stored = window.localStorage.getItem("aapm-theme");
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // Storage can be unavailable in privacy-restricted browsers.
  }

  return "light";
}

function applyTheme(mode) {
  if (typeof document === "undefined") return;

  // Switch every surface in the same frame. Per-element colour transitions
  // (different durations on ~90 elements) otherwise repaint the page in
  // pieces, which reads as the entrance motion replaying.
  const root = document.documentElement;
  root.classList.add("aapm-theme-switching");
  root.classList.toggle("dark", mode === "dark");
  root.style.colorScheme = mode;
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => root.classList.remove("aapm-theme-switching"));
  });
}

function useThemeModeState() {
  const [mode, setMode] = useState(readStoredTheme);

  useEffect(() => {
    applyTheme(mode);
    try {
      window.localStorage.setItem("aapm-theme", mode);
    } catch {
      // Theme still works when persistence is unavailable.
    }
  }, [mode]);

  const toggleTheme = useCallback(() => {
    setMode((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  return { mode, toggleTheme };
}

/**
 * One theme-mode owner for the whole Academy tree. Ten4SevenProvider consumes
 * this state so the canonical token runtime and the existing dark-mode
 * compatibility class always move together.
 */
export function ThemeModeProvider({ children }) {
  const value = useThemeModeState();

  return createElement(ThemeModeContext.Provider, { value }, children);
}

export function useThemeMode() {
  const value = useContext(ThemeModeContext);

  if (!value) {
    throw new Error("useThemeMode must be used inside ThemeModeProvider");
  }

  return value;
}
