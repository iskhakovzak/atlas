'use client';
import { useEffect, type AnchorHTMLAttributes, type MouseEvent, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { startNavigationFeedback } from "@/lib/market/navigation-feedback";

type SiteLinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
> & {
  href: string;
};

const PRESSABLE = '.btn, .cart-link, .icon-btn, .mobile-nav a, .store-tile, .home-stores a';
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

/** Fetches these same-site pages ahead while the phone is idle (the bottom bar's tabs), on phone widths only and
 * never on a data-saving or 2G connection. Joined by the page that is open, so it repeats after each page change. */
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
    let idle = 0;
    // Give the page that just opened its first seconds: images, the account and the first taps go first.
    const timer = window.setTimeout(() => { idle = hasIdle ? window.requestIdleCallback(warm, { timeout: 4000 }) : window.setTimeout(warm, 500); }, 2000);
    return () => { window.clearTimeout(timer); if (hasIdle) window.cancelIdleCallback(idle); else window.clearTimeout(idle); };
  }, [key, router]);
}

// Same-site links change the page in place: the App Router fetches the next page and keeps the header, the bottom
// bar and the loaded account, so moving around feels like an app instead of a reload on every tap.
// next/link is not used: in the vinext 1.0 beta build its lazily imported navigation module lands in a shared chunk
// under minified export names, so every click threw; useRouter is imported statically and works (10.10.2026).
// Still full page loads: the same page with another ?query (those pages read the address once, on load), other
// sites, new tabs and downloads. A link to the page already open scrolls it back to the top, as a tab bar does.
export default function SiteLink({ href, onClick, onPointerDown, ...props }: SiteLinkProps) {
  const router = useRouter();
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
    if (event.button === 0 && target() === "page") prefetchPage(router, href);
  };
  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const kind = target();
    if (kind === "top") { event.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (kind !== "page") return;
    event.preventDefault();
    const link = event.currentTarget;
    startNavigationFeedback(link.matches(PRESSABLE) ? link : null);
    router.push(href);
  };
  return <a href={href} {...props} onPointerDown={warm} onClick={open} />;
}
