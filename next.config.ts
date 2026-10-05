import type { NextConfig } from "next";

// Content Security Policy, report-only for now: violations reach /api/telemetry and show up in
// the operator's error log (Administration → System) before the policy is enforced. Inline
// scripts stay allowed for the streamed RSC payload and the theme script until nonces are wired in.
// Merchant photos come from many store CDNs, hence any HTTPS image source.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://telegram.org",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src https://oauth.telegram.org",
  "frame-ancestors 'none'",
  "form-action 'self' https://accounts.google.com https://oauth.telegram.org",
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
  { key: "Strict-Transport-Security", value: "max-age=15552000" },
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
