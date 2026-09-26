"use client";

import { type ReactNode } from "react";
import { ThemeProvider as NextThemeProvider, useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import type { Locale } from "@/lib/market/i18n";

const subscribeNever = () => () => {};
const getMountedSnapshot = () => true;
const getServerSnapshot = () => false;

export function AtlasThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="atlas-theme"
    >
      {children}
    </NextThemeProvider>
  );
}

export function ThemeToggle({ locale }: { locale: Locale }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeNever, getMountedSnapshot, getServerSnapshot);

  const dark = mounted && resolvedTheme === "dark";
  const labels = locale === "ru"
    ? { dark: "Включить тёмную тему", light: "Включить светлую тему" }
    : locale === "uz"
      ? { dark: "Tungi mavzuni yoqish", light: "Yorug‘ mavzuni yoqish" }
      : { dark: "Switch to dark theme", light: "Switch to light theme" };
  const label = dark ? labels.light : labels.dark;

  return (
    <button
      type="button"
      className="icon-btn theme-toggle"
      aria-label={label}
      title={label}
      aria-pressed={dark}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
    </button>
  );
}
