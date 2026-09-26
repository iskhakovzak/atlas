# Atlas catalog refresh Worker

This is a separate Cloudflare Cron Worker. The Sites/Vinext application does
not have a cron trigger, so the worker calls the protected
`/api/internal/catalog-refresh` endpoint once per hour.

## Configure and deploy

1. Copy `wrangler.toml.example` to `wrangler.toml`.
2. Set the same random secret on the Atlas Site runtime and in this worker as
   `ATLAS_CATALOG_REFRESH_SECRET`. Do not commit it.
3. Deploy with `wrangler deploy` from this directory.
4. Check `GET /health`, then inspect the first scheduled invocation in the
   Worker logs and the operator catalog queue.

The Worker signs `timestamp + POST + /api/internal/catalog-refresh` with HMAC
SHA-256. Atlas rejects stale timestamps, replayed requests, wrong paths and
missing secrets. It never receives customer cookies or merchant credentials.
