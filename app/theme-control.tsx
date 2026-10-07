"use client";

import { type ReactNode, useEffect, useState } from "react";
import { ThemeProvider as NextThemeProvider, useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import type { Locale } from "@/lib/market/i18n";
import {uzText} from '@/lib/market/uz-cyrl';
import {isUzbek} from '@/lib/market/i18n';

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
      enableColorScheme={false}
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
    : isUzbek(locale)
      ? uzText(locale, { dark: "Tungi mavzuni yoqish", light: "Yorug‘ mavzuni yoqish" })
      : { dark: "Switch to dark theme", light: "Switch to light theme" };
  const label = dark ? labels.light : labels.dark;
  // Owner, 7.10.2026: "improve the icon", then "I don't like the sun": one contrast disc, half filled, that turns half
  // a circle at each switch (app/home.css). It turns only after a click, never on load.
  const [moved, setMoved] = useState(false);
  // Owner, 7.10.2026: "the theme switch lags badly". next-themes' disableTransitionOnChange inserted and removed a
  // stylesheet around the switch and then wrote color-scheme into html's inline style: each a restyle of the whole page
  // (~150ms on the home page), even with the same value. Now color-scheme comes from CSS (app/dark-theme.css), the
  // attribute is set here once (next-themes then writes the same value, which costs nothing) and the new theme lands in
  // one restyle, inside a view transition: the page cross-fades on the compositor instead of jumping.
  const toggle = () => {
    const next = dark ? "light" : "dark", html = document.documentElement;
    setMoved(true);
    const apply = () => { html.dataset.theme = next; setTheme(next); };
    const start = (document as Document & { startViewTransition?: (update: () => void) => unknown }).startViewTransition;
    if (start && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) start.call(document, apply); else apply();
  };

  return (
    <button
      type="button"
      className="icon-btn theme-toggle"
      aria-label={label}
      title={label}
      aria-pressed={dark}
      data-moved={moved ? "" : undefined}
      onClick={toggle}
    >
      <svg className="tt-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.9" />
        <path className="tt-half" d="M12 6.4a5.6 5.6 0 0 1 0 11.2z" fill="currentColor" />
      </svg>
    </button>
  );
}
