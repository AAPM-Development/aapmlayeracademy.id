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

  document.documentElement.classList.toggle("dark", mode === "dark");
  document.documentElement.style.colorScheme = mode;
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
