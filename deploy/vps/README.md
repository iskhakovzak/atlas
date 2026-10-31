# Atlas VPS — 31 October 2026

Production: `https://atlasmarket.uz`, Contabo `207.244.243.70`. Cloudflare owns DNS; the apex is DNS only to avoid the previously observed ECH connection resets. `www` redirects to the apex. `gw` and mail records were not edited. The first VPS project, Funded Lime, remains independent.

## Runtime and storage

- `/opt/atlas/compose.yml`: `atlas-web`, Node 22 + the **production** Vinext server; no Wrangler dev process. Automatic Docker restart, non-root user, 2 CPU / 2 GiB ceiling, loopback-only port 18792.
- `/opt/atlas/source`: source used to build the deployed image `atlas-web:20261031b`.
- `/opt/atlas/data/atlas.sqlite`: persistent SQLite, WAL, busy timeout, atomic D1-compatible batches. `scripts/vps-bindings.mjs` implements the D1 operations used by Atlas. Application API, identity checks, projections and server pricing stay intact.
- `/opt/atlas/data/objects`: private document objects. Existing authenticated routes still authorize every read. Keys are hashed into opaque filenames; writes use an atomic rename.
- `/opt/atlas/config/environment.json`: integration configuration, file mode 0600, readable inside the container through a read-only mount. Never print, archive into source, or commit this file.
- `ATLAS_OPERATOR_EMAIL=ishakovzakir0@gmail.com`. Administrator access still requires a verified sign-in with that exact email. Google and Telegram are configured; email OTP, phone and Apple were not configured on the old site and are not claimed to work.

The owner requested a fresh launch. Old Sites: 26 application tables cleared and 4 R2 objects deleted; account/session/order/document reads verified empty. Its audience is now owner-only custom access, all 17 environment entries removed, and the temporary maintenance endpoint removed from the active deployment. The platform deployment remains provisioned; it is no longer the public application. No old customer accounts, orders or documents were migrated. The new authentication secret invalidates old sessions.

The fresh catalog has `bundledSyncDisabled=true`, so reading it does not restore demo cards. Existing stored catalogs without this optional flag remain compatible.

## Shared edge

`prop-deskos-edge-1` already owns ports 80/443. It routes Atlas to `atlas-web:3000` on `prop-deskos_default`, sets the trusted upstream host/protocol and remote client IP, and obtains ordinary public Let's Encrypt certificates for the apex and www. The Node server accepts forwarded hosts only for those names.

Funded Lime deployments were observed to replace the Caddy container and source Caddyfile. `atlas-edge.service` watches for a new running container ID every three seconds, appends `/opt/atlas/edge/atlas.Caddyfile` to that container's existing configuration, validates it before installation and reloads without restarting the other project. It does not edit Funded Lime's source. An unknown pre-existing Atlas route makes it refuse to overwrite the configuration. Final ownership of a shared durable Caddy configuration should be agreed with the other project's maintainer; brief shared-edge restarts still affect both sites.

## Future deployment

Use a clean Git checkout, never copy local runtime folders or secrets. Build with `deploy/vps/Dockerfile` (or its server copy `Dockerfile.vps`), then update the image in `/opt/atlas/compose.yml` and run `docker compose -p atlas -f /opt/atlas/compose.yml up -d`. Preserve both persistent mounts and the external edge network. Do not publish future Atlas changes to Sites.

Keep the image workdir `/srv/atlas`. In the observed Linux build, `/app` caused the home page and `/app` route to silently resolve to the same generated page chunk. `scripts/check-vps-build.mjs` rejects that collision; the deployed image passed it and its actual homepage was checked. Re-check all assets, sign-in redirects, unauthenticated API refusal and a real product import before declaring a release complete. Schema migrations run once on startup; do not modify applied migration files.

For rollback, use a previously verified VPS image with the existing data/config mounts. Do not restore the old Sites DNS target as a data rollback: its demo data and secrets were intentionally removed.

## Backups and verification

`atlas-backup.timer` runs at 02:15 UTC with up to 120 s jitter, retaining seven days in `/opt/atlas/backups`. The backup includes an online SQLite snapshot (integrity checked), private objects and configuration; files are root-private. Object copying is not transactionally synchronized with database writes; pause document writes for a strict point-in-time restore. Off-server backup is not configured.

Validated: 1160 tests, lint, default Worker build, VPS Linux build and chunk check; public HTTPS, www redirect, homepage/catalog/stores/cart/login, 82 page assets, API 401 without a session, missing asset 404 without year-long caching, signed background batch 200 with zero work. Real eBay import returned 82 variants; browser verified photos, stock, sizes and a color price change from $25 to $40. A real Nike import returned 80 variants. Hashed static assets return public, max-age=31536000, immutable. Full interactive Google sign-in to the operator account remains a manual verification; the provider redirect, PKCE and correct callback origin were verified. Test browser tabs and the temporary local/staging servers were closed.
