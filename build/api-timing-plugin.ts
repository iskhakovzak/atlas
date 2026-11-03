// Times every /api/* route without editing the route files (3 November 2026). Each `app/api/**/route.ts` that exports
// `async function GET/POST/…` gets, appended after its own code, one reassignment per method through
// lib/market/api-timing.ts: `POST = timeRouteHandler("/api/import", "POST", POST)`. A function declaration is a live,
// writable module binding, so the framework imports the wrapped handler. The route name is the file's pattern
// (`/api/x/[id]` stays `[id]`), never a request URL. Nothing above the appended lines moves, so source maps stay valid.
import type { Plugin } from "vite";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const exported = new RegExp(`^export\\s+(?:async\\s+)?function\\s+(${METHODS.join("|")})\\s*\\(`, "gm");

/** `/…/app/api/auth/google/callback/route.ts` → `/api/auth/google/callback`; anything else → null. */
export function apiRoutePattern(id: string): string | null {
  const file = id.split("?")[0].replaceAll("\\", "/");
  const match = /\/app((?:\/\([^/]+\))*\/api(?:\/[^/]+)*)\/route\.(?:ts|tsx|js|jsx|mjs)$/.exec(file);
  if (!match) return null;
  // Route groups `(name)` are not part of the address, also before `api` (`app/(shop)/api/x` serves /api/x).
  return match[1].split("/").filter(segment => !/^\(.+\)$/.test(segment)).join("/") || "/api";
}

/** The route module with its exported method handlers wrapped, or null when there is nothing to wrap. */
export function wrapRouteHandlers(code: string, id: string, timingModule = "@/lib/market/api-timing"): string | null {
  const route = apiRoutePattern(id);
  if (!route) return null;
  const methods = [...new Set([...code.matchAll(exported)].map(match => match[1]))];
  if (!methods.length) return null;
  const lines = methods.map(method => `${method} = __atlasTimeRoute(${JSON.stringify(route)}, ${JSON.stringify(method)}, ${method});`);
  return `${code}\nimport { timeRouteHandler as __atlasTimeRoute } from ${JSON.stringify(timingModule)};\n${lines.join("\n")}\n`;
}

export function apiTiming(): Plugin {
  return {
    name: "atlas:api-timing",
    enforce: "post",
    transform(code, id) {
      if (this.environment?.name === "client") return null;
      const wrapped = wrapRouteHandlers(code, id);
      return wrapped === null ? null : { code: wrapped, map: null };
    },
  };
}
