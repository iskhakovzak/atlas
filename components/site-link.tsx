'use client';
import { createContext, useContext, useEffect, type AnchorHTMLAttributes, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { startNavigationFeedback } from "@/lib/market/navigation-feedback";
import type { Locale } from "@/lib/market/i18n";
import { withLang } from "@/lib/seo/locales";

/**
 * The language of a page opened as a `?lang=` version (then the language on screen, which the menu may change), or
 * null on an x-default address. Links to public pages carry it (lib/seo/locales.ts withLang), so a crawler on the
 * Russian version follows Russian links instead of landing on the Uzbek x-default (SEO audit, 1 November 2026).
 */
const PageLangContext = createContext<Locale | null>(null);
export function PageLangProvider({ value, children }: { value: Locale | null; children: ReactNode }) {
  return <PageLangContext.Provider value={value}>{children}</PageLangContext.Provider>;
}
/** The `?lang=` version the page was opened as, in the language now on screen; null on an x-default address. */
export function usePageLang(): Locale | null {
  return useContext(PageLangContext);
}

type SiteLinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
> & {
  href: string;
};

const PRESSABLE = '.btn, .cart-link, .icon-btn, .mobile-nav a, .store-tile';
// Pages asked for under the finger in the last half minute (the router keeps a prefetched page about that long).
const prefetched = new Map<string, number>();
type Router = ReturnType<typeof useRouter>;
function prefetchPage(router: Router, href: string) {
  const now = Date.now();
  if (now - (prefetched.get(href) ?? 0) < 30000) return;
  prefetched.set(href, now);
  // "full" asks for the whole page, not only its shell (next's PrefetchKind.FULL; the enum is not exported at runtime).
  // It brings the page's data, scripts and styles: after it a tab opens in under 100 ms with no network (10.10.2026).
  try { router.prefetch(href, { kind: "full" } as unknown as Parameters<Router["prefetch"]>[1]); } catch { /* the click still loads the page */ }
}

/** The first signs that someone is using the page: warming starts with the first of them. */
export const warmLinkEvents = ["scroll", "touchstart", "pointerdown", "keydown"] as const;
/** Without any of them the pages are still warmed, later. */
export const warmLinksFallbackMs = 8000;

/** Fetches these same-site pages ahead while the phone is idle (the bottom bar's tabs), on phone widths only and
 * never on a data-saving or 2G connection. Joined by the page that is open, so it repeats after each page change.
 * It starts with the first scroll or touch (14.10.2026), not on a timer: a page nobody has touched yet, a speed test
 * among them, does not spend its first seconds on the next pages; someone reading without touching gets them after 8 s. */
export function useWarmLinks(hrefs: string[]) {
  const router = useRouter();
  const key = hrefs.join(" ");
  useEffect(() => {
    if (!key || !window.matchMedia("(max-width: 760px)").matches) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (connection?.saveData || /2g/.test(connection?.effectiveType ?? "")) return;
    const warm = () => key.split(" ").forEach(href => prefetchPage(router, href));
    // Safari has no requestIdleCallback: a plain timer there.
    const hasIdle = typeof window.requestIdleCallback === "function";
    let idle = 0, fallback = 0, started = false;
    const options = { capture: true, passive: true } as const;
    const stop = () => { window.clearTimeout(fallback); for (const type of warmLinkEvents) window.removeEventListener(type, start, options); };
    function start() {
      if (started) return;
      started = true;
      stop();
      // The gesture goes first (a tap may be the navigation itself); the pages are asked for once the phone is idle.
      idle = hasIdle ? window.requestIdleCallback(warm, { timeout: 4000 }) : window.setTimeout(warm, 500);
    }
    for (const type of warmLinkEvents) window.addEventListener(type, start, options);
    fallback = window.setTimeout(start, warmLinksFallbackMs);
    return () => { stop(); if (hasIdle) window.cancelIdleCallback(idle); else window.clearTimeout(idle); };
  }, [key, router]);
}

// Same-site links change the page in place: the App Router fetches the next page and keeps the header, the bottom
// bar and the loaded account, so moving around feels like an app instead of a reload on every tap.
// next/link is not used: in the vinext 1.0 beta build its lazily imported navigation module lands in a shared chunk
// under minified export names, so every click threw; useRouter is imported statically and works (10.10.2026).
// Still full page loads: the same page with another ?query (those pages read the address once, on load), other
// sites, new tabs and downloads. A link to the page already open scrolls it back to the top, as a tab bar does.
export default function SiteLink({ href: given, onClick, onPointerDown, onPointerEnter, onFocus, ...props }: SiteLinkProps) {
  const router = useRouter();
  const href = withLang(given, usePageLang());
  const inSite = href.startsWith("/") && !href.startsWith("//") && !props.target && props.download === undefined;
  const target = () => {
    if (!inSite) return null;
    const next = new URL(href, window.location.href), here = window.location;
    if (next.pathname.startsWith("/api/")) return null;
    if (next.pathname !== here.pathname) return "page";
    if (next.search !== here.search) return null;
    return next.hash && next.hash !== here.hash ? "anchor" : next.hash ? null : "top";
  };
  const warm = (event: PointerEvent<HTMLAnchorElement>) => {
    onPointerDown?.(event);
    if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && target() === "page") prefetchPage(router, href);
  };
  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const kind = target();
    if (kind === "top") { event.preventDefault(); window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? "auto" : "smooth" }); return; }
    if (kind !== "page") return;
    event.preventDefault();
    const link = event.currentTarget;
    startNavigationFeedback(link.matches(PRESSABLE) ? link : null);
    router.push(href);
  };
  return <a href={href} {...props} onPointerDown={warm} onPointerEnter={event => {
    onPointerEnter?.(event);
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (!event.defaultPrevented && event.pointerType === 'mouse' && !connection?.saveData && !/2g/.test(connection?.effectiveType ?? '') && target() === 'page') prefetchPage(router, href);
  }} onFocus={event => {
    onFocus?.(event);
    if (!event.defaultPrevented && target() === 'page') prefetchPage(router, href);
  }} onClick={open} />;
}
