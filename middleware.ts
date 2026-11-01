import { NextResponse, type NextRequest } from "next/server";
import { pageLocaleHeader, supportedLocale } from "@/lib/market/i18n";
import { isPublicPath } from "@/lib/seo/locales";
import { SESSION_COOKIE } from "@/lib/auth/core";
import { storePageRedirect } from "@/lib/market/store-pages";

/** Old document pages → their section of /account/documents (query kept, e.g. ?recipient=). */
export const movedDocumentPages: Record<string, string> = { "/identity": "#passports", "/declaration": "#declarations" };

// `?lang=uz|oz|ru|en` is the hreflang version of a page: the server renders it in that language,
// so crawlers that do not run scripts see the same text as the title. The browser then saves the
// choice (lib/market/store.tsx). A client-sent header is always replaced, never trusted.
export function middleware(request: NextRequest) {
  // The session cookie belongs to one host: www is sent to the main address so a customer is not signed out by it.
  if (request.nextUrl.hostname === "www.atlasmarket.uz") return NextResponse.redirect(new URL(request.nextUrl.pathname + request.nextUrl.search, "https://atlasmarket.uz"), 308);
  // Passports and declarations live on one page since 1 November 2026; old links and bookmarks keep working.
  const moved = movedDocumentPages[request.nextUrl.pathname];
  if (moved) return NextResponse.redirect(new URL("/account/documents" + request.nextUrl.search + moved, request.nextUrl.origin), 308);
  // A store page has one address: an old `/stores?brand=nike` link and `/stores/NIKE` are sent to `/stores/nike` by the
  // server, before any page renders (review of stage 8, 1 November 2026: the browser redirect loaded the directory first).
  if (request.nextUrl.pathname.startsWith("/stores")) {
    const store = storePageRedirect(request.nextUrl.pathname, request.nextUrl.searchParams);
    if (store) return NextResponse.redirect(new URL(store, request.nextUrl.origin), 308);
  }
  const lang = request.nextUrl.searchParams.get("lang");
  // `?lang=RU` is the same version spelled differently: one redirect to the lowercase address keeps a single canonical
  // (it used to render in Uzbek with the x-default canonical; SEO verification, 1 November 2026).
  if (lang && !supportedLocale(lang) && supportedLocale(lang.toLowerCase())) {
    const url = request.nextUrl.clone();
    url.searchParams.set("lang", lang.toLowerCase());
    return NextResponse.redirect(url, 308);
  }
  const requested = supportedLocale(lang);
  if (!requested && !request.headers.has(pageLocaleHeader)) return publicCache(request, xDefault(NextResponse.next()));
  const headers = new Headers(request.headers);
  headers.delete(pageLocaleHeader);
  if (!requested) return publicCache(request, xDefault(NextResponse.next({ request: { headers } })));
  headers.set(pageLocaleHeader, requested);
  return publicCache(request, NextResponse.next({ request: { headers } }));
}

// Without `?lang` a page follows the saved choice (cookie) and the browser language: caches and crawlers are told the
// response depends on both, so one visitor's language is never served to another (SEO audit, 1 November 2026).
function xDefault(response: NextResponse) {
  response.headers.append("Vary", "Accept-Language, Cookie");
  return response;
}

// Vinext marks every dynamic page `no-store`, which also keeps it out of the back/forward cache. A public page opened
// without a session is the same for every guest, so it may be stored but is checked with the server on every use
// (max-age=0, must-revalidate). Signed-in requests and private pages keep `no-store`. Middleware owns Cache-Control
// in vinext (server/middleware-response-headers.js), so this replaces the page default.
function publicCache(request: NextRequest, response: NextResponse) {
  if (!isPublicPath(request.nextUrl.pathname) || request.cookies.has(SESSION_COOKIE)) return response;
  response.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  // A session cookie changes the header shape (app/layout.tsx), so a stored guest copy is never reused for it.
  if (!/\bcookie\b/i.test(response.headers.get("Vary") ?? "")) response.headers.append("Vary", "Cookie");
  return response;
}

// Pages only: API routes, build assets and public files (anything with an extension) skip it.
export const config = { matcher: ["/((?!api/|_next/|.*\\.[a-zA-Z0-9]+$).*)"] };
