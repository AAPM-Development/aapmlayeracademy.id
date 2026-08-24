import { useCallback, useEffect, useState } from "react";

function readStoredTheme() {
  if (typeof window === "undefined") return "light";

  try {
    const stored = window.localStorage.getItem("aapm-theme");
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // Storage can be unavailable in privacy-restricted browsers.
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

function applyTheme(mode) {
  if (typeof document === "undefined") return;

  document.documentElement.classList.toggle("dark", mode === "dark");
  document.documentElement.style.colorScheme = mode;
}

export function useThemeMode() {
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
