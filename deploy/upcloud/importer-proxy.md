# Atlas merchant egress proxy

The Site Worker keeps the importer/parser and all existing URL, redirect, price and variant checks. When `ATLAS_IMPORT_PROXY_URL` and `ATLAS_IMPORT_PROXY_SECRET` are present, only its signed, allowlisted public merchant requests use this VM's New York egress. User-facing API/auth/D1 traffic stays on the Site.

The current bootstrap name is `85-9-196-196.sslip.io`, which resolves to the VM's assigned IP without a user-owned DNS zone. It is a third-party dynamic-DNS dependency, not an Atlas-owned domain. Replace it with an owner-controlled hostname when DNS access is available.

## Server layout

- `/opt/atlas-import-proxy/importer-proxy-server.mjs` and `supported-store-hosts.json`: root-owned source/config; the service runs read-only as `atlas-import-proxy`.
- `/etc/atlas/importer-proxy.env`: root-owned mode `0600`; contains the proxy HMAC secret.
- `/etc/caddy/Caddyfile`: Caddy terminates HTTPS and forwards only `/v1/fetch` to loopback port 8787.
- Systemd `atlas-import-proxy.service`: bounded, HMAC-authenticated, allowlisted HTTPS GETs and the fixed anonymous Amazon US delivery-location POST only.

Do not log target URLs, cookies, request bodies, response bodies, customer identity, or secrets. Keep UFW limited to SSH, HTTP-01/HTTPS ingress (80/443), and loopback for the Node service. The HTTPS certificate is automatically managed by Caddy; the public CA's current certificate policy may change.

## Key rotation and rollout

Generate a fresh random 32-byte hexadecimal secret on the VM. Replace the root-only server environment file and the Site secret `ATLAS_IMPORT_PROXY_SECRET` with the same value, set non-secret `ATLAS_IMPORT_PROXY_URL=https://85-9-196-196.sslip.io/v1/fetch`, then restart the service and deploy the Site version. Never put the value in this repository, a command argument, shell history, or logs.

Refresh `supported-store-hosts.json` from the checked-in source with `node --experimental-strip-types scripts/export-importer-hosts.mjs <output-path>` whenever the merchant allowlist changes. The server rejects hosts absent from this exact snapshot even when a signed client asks for them.
