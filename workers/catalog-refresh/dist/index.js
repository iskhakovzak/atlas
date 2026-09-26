var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
var refreshPath = "/api/internal/catalog-refresh";
var encoder = new TextEncoder();
function hex(bytes) {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
}
__name(hex, "hex");
async function sign(secret, timestamp) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return hex(await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}
POST
${refreshPath}`)));
}
__name(sign, "sign");
async function runRefresh(env, fetcher = fetch) {
  const site = env.ATLAS_SITE_URL.replace(/\/$/, "");
  if (!/^https:\/\//i.test(site)) throw new Error("ATLAS_SITE_URL must use HTTPS.");
  if (!env.ATLAS_CATALOG_REFRESH_SECRET) throw new Error("ATLAS_CATALOG_REFRESH_SECRET is missing.");
  const timestamp = String(Date.now());
  const response = await fetcher(`${site}${refreshPath}`, {
    method: "POST",
    headers: {
      "x-atlas-refresh-timestamp": timestamp,
      "x-atlas-refresh-signature": await sign(env.ATLAS_CATALOG_REFRESH_SECRET, timestamp),
      accept: "application/json"
    }
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Atlas catalog refresh failed (${response.status}): ${body.slice(0, 500)}`);
  return body;
}
__name(runRefresh, "runRefresh");
var worker = {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runRefresh(env));
  },
  async fetch(request) {
    if (new URL(request.url).pathname !== "/health") return new Response("Not found", { status: 404 });
    if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
    return new Response(JSON.stringify({ ok: true, service: "atlas-catalog-refresh" }), {
      headers: { "content-type": "application/json" }
    });
  }
};
var index_default = worker;
export {
  index_default as default,
  runRefresh
};
//# sourceMappingURL=index.js.map
