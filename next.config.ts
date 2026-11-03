import type { NextConfig } from "next";
import { contentSecurityPolicy } from "./lib/security/csp.ts";

// The Content-Security-Policy is enforced on every response (lib/security/csp.ts). This value is fixed at build time;
// `ATLAS_CSP_REPORT_ONLY=1` in the server environment rolls pages back to report-only at request time (middleware.ts).
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Kept with the enforced frame-ancestors: older browsers only know this header (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  // One year: the minimum browsers and Lighthouse treat as a strong HSTS policy. includeSubDomains and preload
  // wait for the owner (every subdomain must serve HTTPS first; preload is hard to undo).
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  // Isolates the window from pages it did not open; popups Atlas opens itself (the Telegram login) keep their
  // opener, so sign-in still works.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
];

const nextConfig: NextConfig = {
  // Metadata (title, canonical, hreflang, robots) goes into <head> for crawlers and link previews. Vinext streams it
  // into <body> for any user agent not on this list, and its default list leaves out Googlebot itself, so Google got
  // canonical and hreflang outside <head>, where it ignores them (SEO audit, 1 November 2026). People keep the
  // streamed metadata. Generating it only reads headers and ?lang, so the blocking render costs bots nothing.
  htmlLimitedBots: /bot|crawl|spider|slurp|Google|yandex|Bing|Lighthouse|facebookexternalhit|facebookcatalog|meta-external|WhatsApp|Telegram|Slack|Discord|Twitter|LinkedIn|vkShare|quora link preview|Yeti|ia_archiver|sogou|preview/i,
  // Vinext's "/:path*" does not match the bare "/" (and "/:path+" matches nothing), so the
  // home page gets its own rule; the two never apply to the same request.
  async headers() {
    return [
      { source: "/", headers: securityHeaders },
      { source: "/:path*", headers: securityHeaders },
    ];
  },
};

export default nextConfig;
