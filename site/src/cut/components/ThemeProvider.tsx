"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { THEME_STORAGE_KEY } from "@/cut/components/ThemeScript";

export type ThemeChoice = "light" | "dark" | "system";

function prefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function isDark(choice: ThemeChoice): boolean {
  return choice === "dark" || (choice === "system" && prefersDark());
}

function readStoredTheme(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  } catch {
    return "system";
  }
}

type ThemeContextValue = { theme: ThemeChoice; setTheme: (theme: ThemeChoice) => void };
const ThemeContext = createContext<ThemeContextValue | null>(null);

// Scoped to the signed-in app (mounted in cut/app/layout.tsx), not the whole
// site: the marketing pages keep their fixed cream look regardless of this
// choice. Toggles `.dark` on the real <html> element rather than a wrapper
// div — portaled popups and dialogs render as siblings of the app's own
// container, so only a class on <html> (or <body>) reaches them too.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>(readStoredTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark(theme));
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => document.documentElement.classList.toggle("dark", prefersDark());
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = (next: ThemeChoice) => {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // A private window or full storage just means the choice doesn't
      // survive the next visit — the toggle itself still works this session.
    }
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
