"use client";

import { type ReactNode, useEffect } from "react";
import { ThemeProvider as NextThemeProvider, useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import type { Locale } from "@/lib/market/i18n";

const subscribeNever = () => () => {};
const getMountedSnapshot = () => true;
const getServerSnapshot = () => false;

/** Keeps the mobile browser bar the colour of the header: white, or the night canvas in dark. */
function ThemeColorSync() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    const color = resolvedTheme === "dark" ? "#0a0e0c" : "#ffffff";
    for (const meta of document.querySelectorAll('meta[name="theme-color"]')) meta.setAttribute("content", color);
  }, [resolvedTheme]);
  return null;
}

export function AtlasThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider
      attribute="data-theme"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      storageKey="atlas-theme"
    >
      <ThemeColorSync />
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
