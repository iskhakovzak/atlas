import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { readExecutionProfile } from "./scripts/execution-profile.mjs";
import { sites } from "./build/sites-vite-plugin";
import { fileURLToPath } from "node:url";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const managedLinux = readExecutionProfile() === "managed-linux";
const vpsTarget = process.env.ATLAS_DEPLOY_TARGET === "vps";

const localBindingConfig = {
  main: "vinext/server/fetch-handler",
  compatibility_flags: ["nodejs_compat"],
  ...(process.env.ATLAS_OPERATOR_EMAIL
    ? { vars: { ATLAS_OPERATOR_EMAIL: process.env.ATLAS_OPERATOR_EMAIL } }
    : {}),
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async () => {
  // Use Miniflare's local Request.cf placeholder unless fetching is requested.
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= "false";
  process.env.WRANGLER_SEND_METRICS ??= "false";

  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.WRANGLER_REGISTRY_PATH ??= ".wrangler/dev-registry";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const cloudflarePlugin = vpsTarget ? [] : [(await import("@cloudflare/vite-plugin")).cloudflare({
    viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
    inspectorPort: false,
    config: localBindingConfig,
  })];

  return {
    ...(vpsTarget ? { resolve: { alias: { "cloudflare:workers": fileURLToPath(new URL("./scripts/vps-bindings.mjs", import.meta.url)) } } } : {}),
    server: {
      ...(managedLinux ? { host: "0.0.0.0", allowedHosts: ["terminal.local"] } : {}),
      ...(isCodexSeatbeltSandbox ? { watch: { useFsEvents: false, usePolling: true } } : {}),
    },
    environments: {
      client: {
        build: {
          rolldownOptions: {
            output: {
              codeSplitting: {
                // app/styles/catalog-cards.css is linked by the server for the catalog pages and loaded by two lazy client
                // parts (the home teaser and the product sheet). Its own chunk gives the browser file the server's name
                // (css/catalog-cards.<hash>.css), so a page that already links it does not fetch a second copy under the
                // teaser's name, and the product sheet no longer pulls in the teaser's script for it (14.10.2026).
                // Joined ahead of vinext's own groups (framework, vinext), which stay as they are.
                // app/styles/link-pages.css likewise: the product sheet loads it lazily on pages whose server HTML already
                // links it (the cart, the account), so the browser file carries the server's name (1 November 2026).
                groups: [
                  { name: "catalog-cards", test: /[\\/]app[\\/]styles[\\/]catalog-cards\.css$/, minSize: 0, priority: 1 },
                  { name: "link-pages", test: /[\\/]app[\\/]styles[\\/]link-pages\.css$/, minSize: 0, priority: 1 },
                ],
              },
            },
          },
        },
      },
    },
    plugins: [
      vinext(),
      // Atlas runs its own sign-in (lib/auth); the Sites ChatGPT mock stays off.
      sites({ mockAuth: false }),
      ...cloudflarePlugin,
    ],
  };
});
