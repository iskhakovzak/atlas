import { z } from "zod";
import { performancePercentile } from "./performance.ts";

// Anonymous field monitoring: script errors, CSP violations and page speed from visitors' browsers.
// Nothing here identifies a person: routes are fixed patterns without query strings, messages are
// scrubbed of addresses, emails and long numbers, and no account, cookie or IP is stored.

/** Share of page views that report speed; errors are always reported. Lower it if traffic grows. */
export const vitalsSampleRate = 1;
export const telemetryRetentionMs = 30 * 24 * 60 * 60 * 1000;

const knownRoutes = new Set(["/", "/stores", "/customs", "/legal", "/login", "/order-by-link", "/cart", "/orders", "/account", "/notifications", "/balance", "/identity", "/declaration", "/favorites", "/admin", "/operations", "/analytics", "/batch-import"]);

/** Maps a pathname to a fixed route pattern; anything else (old links, typos, ids) becomes "other". */
export function telemetryRoute(pathname: string): string {
  const path = pathname.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return knownRoutes.has(path) ? path : "other";
}

/** Removes query strings, emails and long digit runs (phones, passports, card or order numbers). */
export function scrubMessage(value: string, max = 300): string {
  return value
    .replace(/https?:\/\/[^\s"'<>)]+/g, (url) => url.split(/[?#]/)[0])
    .replace(/[^\s@"'<>]+@[^\s@"'<>]+\.[a-z]{2,}/gi, "[email]")
    .replace(/\d[\d\s-]{5,}\d/g, "[number]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

const metric = z.number().finite().min(0).max(600_000).optional();
const errorSchema = z.object({
  kind: z.enum(["error", "rejection"]),
  message: z.string().min(1).max(2000),
  source: z.string().max(500).optional(),
  line: z.number().int().min(0).max(10_000_000).optional(),
});
const payloadSchema = z.object({
  route: z.string().max(300),
  errors: z.array(errorSchema).max(5).default([]),
  vitals: z.object({
    device: z.enum(["mobile", "desktop"]),
    ttfbMs: metric, fcpMs: metric, lcpMs: metric, inpMs: metric,
    cls: z.number().finite().min(0).max(10).optional(),
    apiSlow: z.number().int().min(0).max(1000).optional(),
  }).optional(),
});

export type ClientError = { kind: "error" | "rejection"; message: string; source?: string; line?: number; route: string };
export type VitalSample = { route: string; device: "mobile" | "desktop"; ttfbMs?: number; fcpMs?: number; lcpMs?: number; inpMs?: number; cls?: number; apiSlow?: number };

/** Validates a browser beacon; returns null for anything malformed so the endpoint can ignore it quietly. */
export function parseTelemetry(input: unknown): { errors: ClientError[]; vitals?: VitalSample } | null {
  const parsed = payloadSchema.safeParse(input);
  if (!parsed.success) return null;
  const route = telemetryRoute(parsed.data.route);
  const errors = parsed.data.errors.map((error) => ({
    kind: error.kind,
    message: scrubMessage(error.message),
    route,
    ...(error.source ? { source: scrubMessage(error.source, 200) } : {}),
    ...(error.line !== undefined ? { line: error.line } : {}),
  })).filter((error) => error.message);
  return { errors, ...(parsed.data.vitals ? { vitals: { route, ...parsed.data.vitals } } : {}) };
}

/** Reads a `report-uri` CSP violation report (`application/csp-report`). */
export function parseCspReport(input: unknown): { message: string; route: string; source?: string } | null {
  const report = input && typeof input === "object" ? (input as Record<string, unknown>)["csp-report"] : null;
  if (!report || typeof report !== "object") return null;
  const field = (name: string) => { const value = (report as Record<string, unknown>)[name]; return typeof value === "string" ? value : ""; };
  const directive = (field("effective-directive") || field("violated-directive")).split(" ")[0];
  if (!directive) return null;
  const blocked = field("blocked-uri");
  // Keep only the blocked origin or keyword (inline, eval, data): enough to tune the policy.
  let target = blocked || "inline";
  try { if (/^https?:/.test(blocked)) target = new URL(blocked).origin; } catch { target = "unknown"; }
  let route = "other";
  try { route = telemetryRoute(new URL(field("document-uri")).pathname); } catch { /* keep "other" */ }
  const source = field("source-file") ? scrubMessage(field("source-file"), 200) : undefined;
  return { message: scrubMessage(`CSP ${directive}: ${target}`), route, ...(source ? { source } : {}) };
}

export type VitalsRow = { route: string; device: string; ttfb_ms: number | null; fcp_ms: number | null; lcp_ms: number | null; inp_ms: number | null; cls: number | null };
export type RouteVitals = { route: string; samples: number; mobileShare: number; ttfbMs?: number; fcpMs?: number; lcpMs?: number; inpMs?: number; cls?: number };

/** p75 per route, busiest routes first. */
export function summarizeVitals(rows: VitalsRow[]): RouteVitals[] {
  const byRoute = new Map<string, VitalsRow[]>();
  for (const row of rows) byRoute.set(row.route, [...(byRoute.get(row.route) ?? []), row]);
  const p75 = (list: VitalsRow[], key: "ttfb_ms" | "fcp_ms" | "lcp_ms" | "inp_ms" | "cls") => performancePercentile(list.flatMap((row) => (typeof row[key] === "number" ? [row[key] as number] : [])), 0.75);
  return [...byRoute].map(([route, list]) => ({
    route, samples: list.length, mobileShare: Math.round((list.filter((row) => row.device === "mobile").length / list.length) * 100),
    ttfbMs: p75(list, "ttfb_ms"), fcpMs: p75(list, "fcp_ms"), lcpMs: p75(list, "lcp_ms"), inpMs: p75(list, "inp_ms"), cls: p75(list, "cls"),
  })).sort((a, b) => b.samples - a.samples);
}
