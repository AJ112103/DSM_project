"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "wacmr-theme";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("light", theme === "light");
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const isLight = theme === "light";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const initialTheme = getInitialTheme();
      setTheme(initialTheme);
      applyTheme(initialTheme);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function toggleTheme() {
    const nextTheme = isLight ? "dark" : "light";
    setTheme(nextTheme);
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100"
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      title={isLight ? "Switch to dark mode" : "Switch to light mode"}
      suppressHydrationWarning
    >
      {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      {!compact && <span>{isLight ? "Dark" : "Light"}</span>}
    </button>
  );
}
