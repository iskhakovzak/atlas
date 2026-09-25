# Atlas architecture

## Stack

- React 19 and Next-style App Router through Vinext/Vite.
- Cloudflare Worker runtime.
- Cloudflare D1 binding DB.
- Drizzle schema/migration.
- Hosted ChatGPT identity headers.
- shadcn/Base UI and Lucide.

## Module map

| Area | Files |
| --- | --- |
| Shell/navigation/catalog | app/marketplace.tsx, app/layout.tsx, app/globals.css |
| Deals-first feed/favourites | app/deals-feed.tsx, app/finds.css, lib/market/deals.ts, lib/market/deal-copy.ts, lib/market/catalog.ts; D1-published merchant records with bundled fallback, pricing and authenticated favourite action |
| Shared Atlas visual system | app/atlas-design.css, loaded after base styles in app/layout.tsx; navy/blue/lime palette, responsive hero, cards, account, forms and order surfaces |
| Link order | app/global-link-order.tsx |
| Cart and checkout/payment-test confirmation | app/shopping.tsx |
| Orders, operations, balance and managed pricing UI | app/order-workspace.tsx |
| Analytics, legal/readiness | app/prelaunch-views.tsx |
| Account/customs | app/account-views.tsx, app/customs/page.tsx |
| Identity/declaration/address help | app/identity-workspace.tsx, app/api/passport, lib/market/addresses.ts |
| Batch import/admin catalog/rules | app/batch-import.tsx, app/admin-view.tsx, app/catalog-admin.tsx, lib/market/catalog-editor.ts, lib/market/catalog-server.ts, lib/market/policy.ts |
| Client provider | lib/market/store.tsx |
| Auth/access | app/chatgpt-auth.ts, app/access-view.tsx, lib/market/access.ts |
| API | app/api/account, app/api/actions, app/api/import, app/api/catalog, app/api/internal/catalog-refresh, app/api/operations |
| Domain/security | lib/market/domain.ts, actions.ts, server.ts, world.ts |
| Importing | lib/importer/stores.ts, fetch.ts, extract.ts, shopify.ts |
| Database | db/schema.ts, drizzle/0000_overrated_justice.sql |
| Tests | tests/market.test.mjs, tests/world.test.mjs |

## Runtime flow

~~~mermaid
flowchart TD
  UI[React UI] --> Provider[MarketProvider]
  Provider --> Account[GET api account]
  UI --> Import[POST api import]
  UI --> Catalog[GET or POST api catalog]
  UI --> Actions[POST api actions]
  Account --> Auth[ChatGPT headers]
  Import --> Auth
  Catalog --> Auth
  Actions --> Auth
  Import --> Fetch[Allowlisted public fetch]
  Catalog --> Fetch
  Fetch --> Parse[Generic ProductGroup or Zara extractor]
  Actions --> Domain[Typed domain action]
  Account --> D1[(D1)]
  Actions --> D1
  Catalog --> D1
~~~

MarketProvider loads account state and revision, then sends action plus expected revision. The server parses Zod action input, applies domain function and persists only when revision matches. Conflict returns current state rather than overwriting another tab.

## D1

market_accounts:

| Column | Meaning |
| --- | --- |
| user_id | Primary key email:<lowercase email> |
| name | Display name |
| state | JSON serialized State |
| revision | CAS integer |
| created_at, updated_at | Epoch milliseconds |

market_rate_limits stores per-minute import counters and expiry.

market_settings stores the current versioned pricing JSON, policy JSON and editorial `catalog` JSON with update identity. Catalog writes use a separate document revision and compare-and-swap update; public reads expose only current published snapshots. On read, the server additively reconciles newly bundled merchant records into the same D1 document using a compare-and-swap write. Existing entries—including hidden products and operator edits—win by stable ID or canonical source URL. market_import_cache stores allowlisted extracted product payloads for ten minutes.

market_identity_documents stores owner, private R2 object key, safe file metadata, confirmation status and confirmed JSON. Passport bytes are stored in private BUCKET R2 and never exposed through a public URL.

market_settings also stores a versioned `policy` JSON setting. It defines server-authorized import/cart restrictions and has no client-side source of truth.

The versioned managed `pricing` JSON accepts optional `countryOverrides`, keyed by the existing exact `Product.country` dispatch-country label. Each override can replace only existing fee/rate fields; omitted fields inherit the global tariff. Cart addition, quantity change and renewal resolve the product's dispatch country on the server before quote calculation. Parcel freight/reserve/margin use the matching country tariff, while source-currency FX remains in the centrally managed rates map. Existing stored pricing parses through the empty-object default; submitted-order quote snapshots do not change when an operator edits current rates. `/admin` pricing writes remain authenticated and operator-only through `ATLAS_OPERATOR_EMAIL`, same-origin POST and the existing audit path.

That same versioned pricing record also contains an optional `serviceCatalog` (up to 40 offers; old pricing rows parse through the bundled starter default). An offer has localized RU/UZ/EN copy, enabled state, request stage (`checkout` or `warehouse`), unit, fixed vs. operator-quote pricing, base UZS fee and optional exact dispatch-country fee overrides. The operator edits it through `/operations`; server validation enforces unique safe IDs, positive configured fixed fees, valid required-service placement, and keeps the built-in shipment-insurance offer disabled until insurance terms are actually configured. Disabling an offer does not delete existing order references.

Migration 0004 adds the normalized launch foundation: `market_customers`, `market_order_records`, `market_order_fee_lines`, `market_order_events`, `market_legal_consents`, `market_staff_directory` and `market_audit_events`. Existing `market_accounts` JSON remains the compatible customer-flow source; every successful write now maintains an idempotent operational projection of customers, orders, fee lines and status events. The projection is rebuildable from `/admin` and is safe to reconcile if a secondary write fails. Staff-directory rows do not grant access; `ATLAS_OPERATOR_EMAIL` remains the sole authorization source.

State contains orders, ledger entries, cart, favourites, checkout idempotency keys, saved recipient profiles, support-request history, an optional confirmed identity profile with masked passport number, test declarations, communication preferences, prepared email/SMS records and version. Order contains product snapshot, immutable quote, delivery snapshot, simulated payment, parcel/tracking events, assignment, staff notes, optional customer change requests, optional warehouse inspection, optional `warehouseServiceRequests` snapshots, status/history, both settlement types, approvals, quantity, balance use and customs consent. Cart lines optionally store `requestedServiceIds`. These fields default compatibly for old stored carts/orders; no D1 migration is needed.

Warehouse services use the normal authenticated action path. At checkout the customer can flag `checkout`-stage preferences; checkout snapshots localized service text, unit, configured rate, dispatch country and request origin without changing the initial quote or authorizing work. After an order has warehouse inspection and remains at status 2 (before weighing), its owner can request a `warehouse`-stage offer. The server reads current enabled offers and country fee from managed pricing, snapshots the values, and rejects unknown/disabled/wrong-stage choices. An operator-only linked `change-request-create` checks the exact fixed price or records a quote; the customer must approve/decline the exact amount. An operator can also mark the request unavailable with a reason. `warehouse-service-complete` is operator-only and requires approval. Any requested, quoted or approved service blocks weighing until completed/declined; checkout preferences do not block purchase progression before arrival. Approved prices are represented by existing approved change requests and remain separate from the immutable quote. This is a pre-release workflow only: there is no connected warehouse execution or real additional charge, and “complete” is only a simulated status. Insurance cannot be enabled until insurer, coverage, exclusions and claims are verified.

Multiple recipient passports extend the existing JSON state compatibly: `identityProfiles` is optional, while the legacy `identityProfile` remains a latest-confirmation mirror. Each confirmed masked identity may carry an optional `recipientProfileId`; the scan bytes continue to use the owner-scoped private passport object path. `identity-confirm` validates the recipient ID against the authenticated account's saved addresses, and the D1 document status update stores only the matching masked identity. Checkout accepts optional recipient/document IDs, resolves both from server account state, and ignores browser-submitted delivery fields whenever a saved recipient ID is selected. Each order optionally snapshots `deliveryProfileId` and the matching masked identity alongside its delivery address. Old orders have neither field and continue to use compatible legacy fallback state.

Declaration previews derive identity and address from the selected order snapshot (or compatible legacy state) and reject a mixed-recipient batch. Removing an address unlinks its current profile identity but leaves immutable historical order/declaration snapshots intact. The account no longer exposes customer JSON export/download; operator-only D1 backup export is a separate operational feature and is unchanged.

## APIs

| Endpoint | Contract |
| --- | --- |
| GET /api/account | identity → user, state, revision |
| POST /api/import | identity + same origin + URL → Extracted data, 12/min |
| GET /api/catalog | public published catalog, or operator-only full draft document with `?admin=1` |
| POST /api/catalog | operator identity + same origin + document revision → import/discover/edit/publish/hide/collection command + audit event |
| POST /api/catalog-availability | customer identity + same origin + rate limit + exact catalog ID/source → persisted available/unavailable report and operator-review marker |
| POST /api/internal/catalog-refresh | scheduler-only HMAC signature + D1 lease → one bounded due batch; no browser identity, CORS or caller-controlled limit |
| POST /api/actions | identity + same origin + action/revision → next state |
| GET /api/operations | operator identity → customer/support queues, pricing, policy, projection health, staff directory and audit events |
| POST /api/operations | operator identity + validated payload → order/support action, customer access, projection rebuild, pricing, policy or staff-directory update + audit event |
| GET/POST /api/order-documents | owner/operator listing and download; operator-only private R2 upload for invoice, purchase proof and warehouse material |
| GET /api/backup | operator-only D1 JSON export with checksum and audit record; blob bytes excluded |
| GET /api/passport | authenticated identity → own document metadata only |
| POST /api/passport | identity + same origin + multipart image/PDF → private R2 object + D1 metadata |
| DELETE /api/passport?id=… | identity + same origin + ownership → delete private object and metadata |

Action types additionally include identity-confirm, identity-clear, declaration-preview, `cart-services`, `warehouse-service-request`, `warehouse-service-complete`, `warehouse-service-decline`, change-request-create, change-request-respond and warehouse-inspect. Identity confirmation requires an owner-scoped D1 passport record; the server masks the number before account persistence. Declaration snapshots are recomputed from confirmed state and selected server-side orders. Cart additions, service selection, quantities and checkout run against current server pricing and policy: category/keyword checks, count, weight and merchandise value. Assignment, staff notes, parcel changes, change-request creation, warehouse inspection/completion/decline, advance, receive and merchant-shipping confirmation require operator on server. Warehouse-service requests are owner-only; customer change responses run only in the owning account action route and compare the expected amount. Cross-customer actions additionally verify the target account revision. Cart checkout can invoke the existing `payment-demo` action directly in the cart success flow; it is not a real payment integration.

Linked products pass an additional source-freshness boundary in `/api/actions`: the server fetches the allowlisted public page on cart addition and checkout, resolves the stored optional merchant variant ID (or exact label fallback), and compares availability, currency and source price before the domain action runs. This check never trusts client-supplied freshness timestamps and sends no store credentials. A one-option product may use a different neutral fallback label in a dated catalog snapshot; the server normalizes that label only when the live source also exposes exactly one option, while still enforcing live availability and price. Catalog rechecks use the same bounded importer; change and error markers remain optional fields in the existing versioned catalog JSON. Customer availability reports are also optional catalog fields, so old D1 documents remain valid without a migration. The link-order UI no longer asks customers to open the merchant page or report stock manually: it retries the protected import automatically and keeps cart addition disabled until the automatic source check succeeds. Reports cannot change the published snapshot; they flag the operator draft until a protected recheck or operator hide resolves them.

After a successful source-backed `cart-add`, the action route passes the verified importer snapshot to `addCustomerLinkDraft`. That helper canonicalizes the allowlisted source URL, performs an optimistic D1 catalog write only when no matching draft or published entry exists, and records a `catalog.customer-link` audit event. The result is a draft with a customer-demand review reason; it is intentionally not published or treated as Atlas inventory. A concurrent duplicate request is resolved by the catalog document's compare-and-swap revision, so the side effect is idempotent without weakening the account/cart transaction.

Catalog source observations have a second, non-customer path. Each entry may store optional due/attempt/success/error/status metadata and an auto-hide reason. `refreshDueCatalog()` selects at most five due cards from distinct source hosts, fetches with a global concurrency of two, rereads the D1 document before its compare-and-swap write, and records a system audit event. It can update a complete, explicitly in-stock source snapshot or unpublish a definitive all-sold-out matrix; it never hides on a failed, blocked or incomplete source response. The internal endpoint authenticates a `POST` with a five-minute HMAC timestamp/signature and holds a two-minute D1 lease. The current Sites artifact has no `scheduled` handler or cron trigger, so a separate scheduled Worker must call that endpoint with `ATLAS_CATALOG_REFRESH_SECRET`; no `setInterval` or user browser is treated as a scheduler.

When a public catalog card opens `/order-by-link?url=…`, the client auto-starts the protected import instead of asking the customer to submit the same URL again. It renders the imported colour/size/model matrix and preliminary calculation, then submits a normal `cart-add` action only after the customer confirms the selected combination. The link query is navigation context only: the action route repeats source verification before persisting the cart line. The public grid does not append separate client-only products: catalog administration, collections, favourites and ordering all resolve the same D1-backed catalog IDs and published snapshots.

Pricing stores base international freight and delivery margin separately. International freight uses at least 1 kg per merchant parcel. During every cart add, quantity change and quote renewal, linked lines with the same normalized source host and dispatch country are repriced together: boxed weights are summed, the 0.3 kg packaging and 0.2 kg safety allowance are added once, and freight/reserve/delivery margin are allocated back to the line quotes so checkout and later order snapshots remain additive and immutable. Operational projection uses the current payable amount and creates separate fee lines for approved change requests while the original quote remains untouched. Warehouse receiving requires a saved inspection; damaged or mismatched intake needs an approved resolution created after that inspection.

## Environment and services

| Value | Use |
| --- | --- |
| DB | Required D1 binding |
| ATLAS_OPERATOR_EMAIL | Optional Worker secret granting operator role |
| ATLAS_CATALOG_REFRESH_SECRET | Required only by an external scheduled Worker to HMAC-sign bounded catalog-refresh calls |
| BUCKET | Private R2 storage for owner-scoped passport scans |

Migration 0005 adds `market_order_documents`, `market_operational_errors` and `market_backup_exports`. Private files remain in R2; D1 keeps ownership, classification and audit metadata.

No payment processor, eBay API, carrier API, automatic FX API, email/SMS provider or standalone identity provider exists. Payment webhooks, tracking and external messages are safely represented inside Atlas for the pre-release demo only. FX/tariffs are operator-managed and product imports have a short D1 cache.

## Security

Importer expansion: `shopify.ts` builds only allowlisted locale-aware `/products/{handle}.js` and read-only `/cart.js` URLs for 20 explicit storefront roots. Both use the same anonymous request context; cart currency must be explicit before accepting monetary fields. Kith requests add the public `country=US` context to both endpoints to prevent IP-localized price/currency mismatch, and Satechi's old `.net` root is canonicalized to the allowlisted `.com` storefront. Explicit store profiles classify ambiguous clothing, beauty, sneaker and electronics titles. `extract.ts` also performs bounded dedicated parsing for Zara, Anker embedded Next data and Gymshark active-color markup, with ProductGroup/JSON-LD fallback. JSON redirects must remain same-origin; all redirects still pass the store allowlist. Shared fetch retains a 15-second overall deadline, four-request redirect limit, 3 MB HTML / 1 MB JSON caps and bounded photo/variant arrays. Endpoint failures fall back to HTML without customer cookies. Catalog variants preserve optional id, color, size and second-axis `sizeLabel`; old stored drafts remain compatible. Submitted products retain the selected photo and combined variant label.

- Identity only from request headers on server.
- Same-origin write/import routes.
- Maximum 1 MB JSON account state.
- Passport uploads require sign-in, same origin, owner-scoped keys, JPG/PNG/PDF MIME plus magic-byte validation, and an 8 MB limit.
- Zod action schemas and server recalculation.
- Merchant allowlist and redirect validation.
- Time/body caps, captcha detection and safe image validation.
- No cookies/auth sent to stores.

## Deployment

.openai/hosting.json currently points to ChatGPT Sites project appgprj_6aa181097a00819196698407b43a6a45 and maps D1 binding DB. The current hosted site audience is public; customer and administrator data remain protected by server-side identity and role checks.

Current deployment procedure: commit; request temporary Sites repo credential; push exact HEAD; package site; save a version with exact pushed SHA; deploy the saved version with the site's current audience; poll success. Never persist the temporary token.

The verification suite includes lint, Node domain/security tests, production build, a dependency-free public browser smoke test and an authenticated API smoke covering checkout, payment, assignment, parcel, tracking, warehouse and email/SMS previews.

## Informational customs UI (2026-09-11)

`lib/market/customs.ts` contains a pure, date-aware personal courier estimator and official LexUZ references. `app/customs-estimate.tsx` provides localized, disclosure-based inputs and display. It is used in product details, link import, aggregate cart and /customs; never modifies price(), quotes, checkout payload, ledger, consent version or persisted state. Prior imports are manually entered, not inferred from prototype orders. Additional value and dutiable-weight uncertainty remain explicit. Old accounts/orders require no migration.

## Client access states (2026-09-11)

`MarketProvider` treats session loading, guest, authenticated and connection failure as distinct states. On a 401 or failed refresh it clears the user, account revision and private state so another user or a signed-out tab cannot see stale account data. `AccessView` is the common render gate for member/admin routes. It preserves safe same-origin return paths through the platform sign-in flow. Guest language is device-local; authenticated language remains account-backed.

This UI gate improves navigation and privacy but is not the authorization boundary. Account APIs still derive identity from platform headers. Operator APIs compare the authenticated email with `ATLAS_OPERATOR_EMAIL` and return 403 before reading cross-customer data or accepting an operator action. No D1 schema or stored-account format changed.
# UX refinement — September 15

Shared presentation overrides are in `app/experience.css`. Order summaries defer rendering their full details and document requests until expanded; order-ID hash links open the matching row. Checkout has delivery and review UI steps but retains the existing authenticated checkout action and server recomputation. Legal hash links expand their target section. Catalog admin search, filters and pagination operate on the existing catalog document; no persistence or API schema changed.

`AccountView` derives its dashboard priority locally from the already authenticated account snapshot: pending customer approval, pending simulated payment, missing confirmed identity, missing saved recipient, then the current order. The links only navigate to existing protected workflows; authorization and mutations remain in their existing APIs/domain actions.

# SEO and public crawl boundaries — September 19, 2026

Public metadata is defined in `app/layout.tsx` and remains honest about preliminary pricing and delivery estimates. It declares a canonical production origin, Open Graph/X fields and RU/UZ/EN locale hints without exposing private account data or claiming a live payment/carrier integration.

`public/robots.txt` and `public/sitemap.xml` are static deployment assets because the current Vinext build does not register Next metadata route modules as standalone routes. The sitemap intentionally contains only the public catalog, customs guidance and legal pages. Authenticated, operator and API paths are disallowed from crawling.

Shared shell labels continue to come from `lib/market/i18n.ts`; the SEO pass moved breadcrumb, footer, saved-items, retry and sign-in labels onto the same dictionary. Merchant titles, source URLs and product descriptions are not machine-translated.

`public/llms.txt` is a concise public factsheet for AI/search systems. `public/robots.txt` explicitly allows `OAI-SearchBot` and `GPTBot` on public content and keeps account/API/operator paths blocked. This separation does not guarantee ranking or inclusion in ChatGPT Search and does not expose authenticated data.

## Language state across full-page route changes — September 19, 2026

`MarketProvider` treats the locale preference as a small, validated device hint (`ru`, `uz` or `en`) until an account is available. After authentication, the server remains the source of truth: if the device hint differs from the account snapshot, the provider replays the existing `communication-save` action with the current revision. The UI updates immediately, so a full-page `<a>` navigation cannot visibly fall back to Russian while the save is pending. No password, identity or order data is stored in local storage.

Account disclosure panels are rendered as controlled accessible buttons with one `openSection` key. The old native-details pattern could leave sibling panels visually open after a click; the new component keeps the address/customs/documents/support panels mutually exclusive without changing persistence or API actions.

Customer transactional copy follows the same locale state: order cards and approval/settlement dialogs, balance, notification filters/settings and dynamic link-import status messages select RU/UZ/EN at render time. Canonical product names, merchant-provided descriptions, source URLs and server-authored history remain data, not machine-translated UI labels. Operator tools, legal body text and remaining server error templates stay explicit follow-up work.

## Conversion continuity and release safeguards — September 20, 2026

The catalog's manual-link form validates navigation context in the browser, then sends a guest through the existing safe `signInPath()` return route. After sign-in, `/order-by-link` still performs the protected import and the server repeats merchant/source verification before any cart action; the URL is not an authorization or pricing input.

The same form stores a bounded, non-sensitive session draft keyed by the requested source URL. It restores imported and edited values after a locale switch or route remount while the source freshness window is active; it never replaces the server-side verification or persists customer data to D1.

`AccountView` derives a non-destructive priority from the authenticated snapshot: customer approval, simulated payment, active order, non-empty cart, then missing recipient. Passport remains available through its existing protected workflow rather than being inserted ahead of a customer's immediate order task. The address form only uses the repository's local `addresses` lists through browser-native datalists; it introduces no external address-search request or new persisted field.

`MarketProvider` keeps short generic request failures in the currently selected locale. For a non-Russian locale it intentionally does not surface a Russian server error verbatim; this avoids a language leak without treating server text as translated product content. Product sheets and catalog entry points use the same locale state.

Order-document download responses retain owner/operator authorization, attachment disposition and `private, no-store`; they now add `X-Content-Type-Options: nosniff`. This is endpoint-level hardening, not a substitute for deployment-wide response headers. At the Sites/Cloudflare edge, production must verify a CSP, frame protection, referrer policy and a global `nosniff` policy, and verify that `oai-authenticated-user-*` headers are injected by the trusted host and stripped from untrusted public requests.

Public catalog visibility has a seven-day observation lifetime. An empty catalog after expiry is intentional: it is safer than presenting an old merchant price. `scripts/audit-ui.mjs` can still exercise guest/account/permission/layout behavior in that safe-empty state and records skipped catalog-card checks; `ATLAS_AUDIT_REQUIRE_CATALOG=1` turns the same condition into an explicit release failure. A release needs fresh, operator-reviewed D1 snapshots before browser flows that require a product card can pass.

The 20 September 2026 editorial deal batch is direct-merchant by construction: Slickdeals may inform selection, but bundled products store only canonical allowlisted Amazon/eBay URLs and merchant-hosted images. The source observation date and expiry stay visible to the freshness/recheck pipeline; no aggregator URL is used for navigation, import or checkout.

For `amazon.com`, `fetchProduct` and collection reads use a request-scoped anonymous cookie jar. They force USD/English preferences, call Amazon's public delivery-location endpoint with ZIP `19701`, validate the returned `US` address, then fetch the page again and parse the US `corePrice` block. Amazon pages are allowed a separate bounded 6 MB HTML ceiling because their client-side state is larger; ordinary public pages retain the 3 MB ceiling. The authenticated import route bypasses its generic ten-minute cache for Amazon, so legacy or stale pre-US snapshots can never skip the location check. Cookies never cross users or persist in D1/R2. A failed location confirmation is a hard import failure, which prevents an Uzbekistan-IP price or delivery promise from entering a quote.

For `adidas.com` product URLs, the HTML route is treated as untrusted because Adidas may return an Akamai challenge to server requests. The importer first uses the bounded public PLP JSON for the URL's locale and slug (it carries the canonical card, price, gallery and `availableSizes`), then enriches it with same-host product JSON when available. Both responses must match the URL's exact article code before accepting data. Adidas rate-limits Chromium client-hint/XHR headers, so the adapter uses a minimal credential-free public header set and permits only the fixed `adidas.com` ↔ `www.adidas.com` edge redirect. Structured clothing/jersey labels map to the clothing category. It retries Adidas' fixed apex edge route when the `www` route is rate-limited and never turns a challenge/429 page into a successful empty import; if both public routes are unavailable, the customer receives the normal manual-entry fallback.

## Priority merchant importer contract — 22 September 2026

The importer uses `merchant-profiles.ts` as a metadata and observability registry for the first two merchant waves. It does not grant adapter permission by itself: `allowedUrl` remains the explicit HTTPS root allowlist, and `fetchProduct` remains the only public-fetch entry point with redirect, body, timeout, image and no-credential protections.

Structured product extraction is exact-listing-first. A Product/ProductGroup node is accepted only when its URL or offer URL matches the normalized source origin/path and safe product-defining query; unrelated recommendations are ignored. Variant IDs use a unique SKU/GTIN when available and otherwise retain label matching. The optional `availabilityKnown` flag distinguishes explicit in-stock/out-of-stock signals from pages that omit stock. The verifier rejects unknown selected options and the catalog refresh worker never republishes or auto-hides a snapshot from an unknown matrix.

An external scheduler can call `/api/internal/catalog-refresh` through `scripts/catalog-refresh.mjs`. The script signs `timestamp + POST + path` with `ATLAS_CATALOG_REFRESH_SECRET`; it is intentionally separate from Sites/Vinext because the current deployment has no cron trigger. No merchant login, CAPTCHA bypass, customer cookie or third-party credential is permitted.

## Priority merchant embedded fallback — 22 September 2026

`extractProduct` checks a small allowlisted set of priority-1/priority-2 origins for public JSON state scripts (`__NEXT_DATA__`, `__PRELOADED_STATE__`, `__INITIAL_STATE__`, and `__APOLLO_STATE__`) before the generic JSON-LD/Open Graph fallback. The candidate walker is bounded by payload size, depth and node count. It accepts a candidate only when a canonical URL/path or strong listing identifier matches the supplied source URL; recommendations and short generic numeric ids are ignored.

The adapter normalizes only merchant-published title, brand, category, price, currency, safe HTTPS images, SKU/GTIN, option labels, explicit availability, shipping and bounded weight. Missing availability is marked `availabilityKnown: false`, not treated as in stock. It never sends credentials or customer cookies, follows unapproved redirects, or attempts a CAPTCHA/login flow. A page with no exact embedded candidate continues through the generic parser and can still require manual entry.

ASOS uses a dedicated public-page parser because its product size map and `stockPriceResponse` are separate script assignments rather than a single JSON state object. The adapter requires the page product ID to equal `/prd/<id>`, then joins size records with stock/price rows by exact numeric variant ID. Missing joins remain unknown and cannot be treated as confirmed stock. A live check on 23 September 2026 returned a USD price, 8 sizes and one explicitly in-stock size; this is a point-in-time observation, not a guarantee of later availability.

`workers/catalog-refresh/` is intentionally a separate deployable Cloudflare Worker. Its scheduled handler calls the Site endpoint with Web Crypto HMAC headers and its health handler exposes no secret. The example configuration contains only the public Site URL; the shared secret must be provisioned independently in both runtimes before enabling the hourly trigger.
