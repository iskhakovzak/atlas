# Atlas background batch Worker

This standalone Cloudflare Cron Worker calls `/api/internal/catalog-batch` every minute. It sends no job, URL or operator identity. The Site selects a server-owned job, rechecks its owner's permissions and claims one bounded ten-link slice. The Worker makes at most two sequential calls per invocation, stops early when there is no work, and never starts another call after 30 seconds. Each request has an 85-second timeout and does not follow redirects. Failed requests are reported with a reason code, never with URLs, credentials or response bodies.

This is source only: it is **not running until deployed and verified**. The queue can still advance from an open admin page. When no batch is ready, the Site executor also advances an eligible eBay storefront job whose operator identity was recorded at an authenticated start or resume; old jobs must be resumed by their owner first.

## Setup after the Site supports the batch endpoint

1. Generate a new random secret using a trusted secret manager. Configure the same value as `ATLAS_CATALOG_BATCH_SECRET` in the Site runtime and in this Worker. Do not print or commit the value. It is independent of `ATLAS_CATALOG_REFRESH_SECRET`; do not alter or reuse the refresh secret.
2. Verify `ATLAS_SITE_URL` in `wrangler.toml` is the HTTPS origin for the intended Site deployment. It must be an origin without a path, credentials, custom port or query. The exact URL is not supplied by a user request.
3. Using an authorized Cloudflare account, securely provision the Worker secret with the provider's secret mechanism and deploy this Worker with its `wrangler.toml`. Apply the Site setting and deploy the Site with the endpoint first. Do not add the secret to `[vars]`, source control, CI logs or shell history.
4. Verify one scheduled invocation in Worker logs and the progress of a small, deliberately created admin job after closing the admin page. Only counts and reason codes should appear in logs. Confirm the endpoint rejects missing/wrong signatures and that the existing refresh job still works with its separate secret. Cron changes may take time to propagate.
5. To stop the job, remove its cron trigger or disable the Worker; existing batch data stays in D1 and remains resumable from the admin page. If a request was interrupted, its claim expires after three minutes before it can be retried.

## Boundaries and risks

Cron may be delayed, delivered more than once or overlap a previous invocation. The Site checks HMAC time and endpoint path, rejects a reused signed timestamp, and uses a D1 compare-and-swap lease for each job. Each slice reads live stores and can take time; site availability, source throttling and incomplete data are still possible. A Worker invocation can last longer than one minute, so the overlap and retry behavior must be observed in production. Each scheduled call uses Worker requests and may trigger paid provider reads according to existing Site settings; review limits and costs before activation. Run integration checks and the complete project test suite before deploying.
