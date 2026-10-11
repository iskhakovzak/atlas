import type { NextConfig } from "next";

// Content Security Policy, report-only for now: violations reach /api/telemetry and show up in
// the operator's error log (Administration → System) before the policy is enforced. Inline
// scripts stay allowed for the streamed RSC payload and the theme script until nonces are wired in.
// Merchant photos come from many store CDNs, hence any HTTPS image source. Impact's partner tag
// (lib/market/impact-tracking.ts, after consent) loads from utt.impactcdn.com and, per Impact's docs, older tags
// and events use *.impactradius-event.com; its pixels are images (already any HTTPS).
const impact = "https://utt.impactcdn.com https://*.impactradius-event.com";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://telegram.org ${impact}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${impact}`,
  "frame-src https://oauth.telegram.org",
  "frame-ancestors 'none'",
  "form-action 'self' https://accounts.google.com https://appleid.apple.com https://oauth.telegram.org",
  "base-uri 'self'",
  "object-src 'none'",
  "report-uri /api/telemetry",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  // The CSP above only reports, so its frame-ancestors does not stop framing yet: this header does (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  // One year: the minimum browsers and Lighthouse treat as a strong HSTS policy. includeSubDomains and preload
  // wait for the owner (every subdomain must serve HTTPS first; preload is hard to undo).
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  // Isolates the window from pages it did not open; popups Atlas opens itself (the Telegram login) keep their
  // opener, so sign-in still works.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy },
];

const nextConfig: NextConfig = {
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
