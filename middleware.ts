import { NextResponse, type NextRequest } from "next/server";
import { pageLocaleHeader, supportedLocale } from "@/lib/market/i18n";

// `?lang=uz|ru|en` is the hreflang version of a page: the server renders it in that language,
// so crawlers that do not run scripts see the same text as the title. The browser then saves the
// choice (lib/market/store.tsx). A client-sent header is always replaced, never trusted.
export function middleware(request: NextRequest) {
  // The session cookie belongs to one host: www is sent to the main address so a customer is not signed out by it.
  if (request.nextUrl.hostname === "www.atlasmarket.uz") return NextResponse.redirect(new URL(request.nextUrl.pathname + request.nextUrl.search, "https://atlasmarket.uz"), 308);
  const requested = supportedLocale(request.nextUrl.searchParams.get("lang"));
  if (!requested && !request.headers.has(pageLocaleHeader)) return NextResponse.next();
  const headers = new Headers(request.headers);
  headers.delete(pageLocaleHeader);
  if (requested) headers.set(pageLocaleHeader, requested);
  return NextResponse.next({ request: { headers } });
}

// Pages only: API routes, build assets and public files (anything with an extension) skip it.
export const config = { matcher: ["/((?!api/|_next/|.*\\.[a-zA-Z0-9]+$).*)"] };
