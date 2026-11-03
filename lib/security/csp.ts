// Content Security Policy for every Atlas response (next.config.ts) and its request-time rollback (middleware.ts).
//
// Enforced since 3 November 2026, after a crawl of every page in Chromium and WebKit, signed out, as a customer and as
// the operator, with cookies accepted and declined, found no violation. Violations still reach /api/telemetry and show up
// in the operator's error log (Administration → System, area "csp").
//
// - Inline scripts stay allowed: vinext streams the RSC payload and its bootstrap inline, and the layout has the theme and
//   Impact bootstrap scripts. A nonce rollout is a separate task (TODO.md).
// - Merchant photos are hotlinked from many store CDNs (eBay, Nike, adidas, Amazon, Zara…), hence any HTTPS image;
//   data: and blob: cover inline SVG placeholders, pasted screenshots and picked photos.
// - Impact's partner tag (lib/market/impact-tracking.ts, only after consent) loads from utt.impactcdn.com; per Impact's
//   docs older tags and events use *.impactradius-event.com. Its pixels are images (already any HTTPS).
// - Telegram's login widget is a script from telegram.org that opens an iframe on oauth.telegram.org. It is loaded
//   without data-onauth, which it would eval(): no 'unsafe-eval' (lib/auth/telegram-widget.ts).
// - Google and Apple sign-in are top-level navigations through /api/auth/* (CSP does not restrict them), never scripts
//   or frames; form-action still lists both (and Telegram) for a form that ends in their redirect.
// - Not allowed on purpose: WebAssembly and blob: workers. The passport OCR (app/passport-ocr.ts, tesseract.js) is not used
//   by any page today; wiring it back needs 'wasm-unsafe-eval' in script-src and `workerBlobURL: false` (or blob: in
//   worker-src), or the policy blocks it (TODO.md).
const impact = ["https://utt.impactcdn.com", "https://*.impactradius-event.com"];

export const cspReportPath = "/api/telemetry";

export const cspDirectives: ReadonlyArray<readonly [string, ...string[]]> = [
  ["default-src", "'self'"],
  ["script-src", "'self'", "'unsafe-inline'", "https://telegram.org", ...impact],
  ["style-src", "'self'", "'unsafe-inline'"],
  ["img-src", "'self'", "data:", "blob:", "https:"],
  ["font-src", "'self'", "data:"],
  ["connect-src", "'self'", ...impact],
  ["frame-src", "https://oauth.telegram.org"],
  ["frame-ancestors", "'none'"],
  ["form-action", "'self'", "https://accounts.google.com", "https://appleid.apple.com", "https://oauth.telegram.org"],
  ["base-uri", "'self'"],
  ["object-src", "'none'"],
  ["report-uri", cspReportPath],
];

const serialize = (directives: ReadonlyArray<readonly string[]>) => directives.map((parts) => parts.join(" ")).join("; ");

/** The full policy: enforced by default, only reported while rolled back. */
export const contentSecurityPolicy = serialize(cspDirectives);

/**
 * What stays enforced while the policy is rolled back: directives that no page needs to break (no framing, no <base>,
 * no plugins). They also keep the build-time enforcing header from being added (vinext adds next.config headers only
 * when the response has none of that name).
 */
export const rollbackContentSecurityPolicy = serialize([["frame-ancestors", "'none'"], ["base-uri", "'self'"], ["object-src", "'none'"], ["report-uri", cspReportPath]]);

/**
 * `ATLAS_CSP_REPORT_ONLY=1` (or `true`) in the server environment rolls the policy back to report-only. On the VPS the
 * value comes from environment.json, where it may be written as a JSON number or boolean (`1`, `true`) as well as a string.
 */
export function cspReportOnly(value: unknown): boolean {
  return value === true || value === 1 || (typeof value === "string" && /^(1|true|yes)$/i.test(value.trim()));
}

/**
 * The full policy as sent while rolled back. Its reports go to `?csp=report-only`: WebKit leaves `disposition` out of
 * report-uri reports, so the address is what tells the error log that nothing was blocked.
 */
export const cspReportOnlyQuery = "csp=report-only";
export const reportOnlyContentSecurityPolicy = serialize(cspDirectives.map((parts) => (parts[0] === "report-uri" ? ["report-uri", `${cspReportPath}?${cspReportOnlyQuery}`] : parts)));

/** Rollback on a page response: the full policy is only reported, a policy that cannot break a page is enforced. */
export function applyCspRollback(headers: Headers) {
  headers.set("Content-Security-Policy", rollbackContentSecurityPolicy);
  headers.set("Content-Security-Policy-Report-Only", reportOnlyContentSecurityPolicy);
}
