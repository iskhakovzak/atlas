# Atlas architecture

## Catalog navigation context and source-shipping fields — 30 September 2026

`findOrderUrl()` adds a `catalog` product ID to catalog-card navigation. The order-by-link screen loads the public catalog for this route and uses the exact source URL + ID match as UI context, not as authority for price or permission. A catalog-backed item keeps Atlas-authored name, category and boxed weight fixed; store-to-warehouse shipping comes from the catalog record and is not replaced by merchant-page shipping. Customers can still select an available variant. Changing the link switches the form back to editable manual-entry behavior. Fresh merchant import and the authenticated `/api/actions` recalculation remain in place.

`CatalogDraft.sourceShippingUsd` and `CatalogDraft.sourceShippingEstimated` are optional, backward-compatible fields. New imports start with a $10 estimated reserve. Public catalog serialization uses those operator-owned values and maps confirmed shipping to `shippingKnown`; scheduled rechecks retain the previous editorial shipping settings. Old D1 JSON rows parse without a migration and default to the same $10 estimated reserve.

`atlasServiceBreakdown()` is a display helper only: it groups the existing `service + buyout + conversion` and `shipping + deliveryMargin` components. Domain quote values, stored orders, fee lines, cart totals and server validations stay unchanged.

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
| Shell/navigation/catalog | app/marketplace.tsx, app/layout.tsx, app/globals.css, app/supported-stores.tsx |
| Deals-first feed/favourites | app/deals-feed.tsx, app/finds.css, lib/market/deals.ts, lib/market/deal-copy.ts, lib/market/catalog.ts; D1-published merchant records with bundled fallback, pricing and authenticated favourite action |
| Shared Atlas visual system | app/atlas-design.css plus app/experience.css; responsive hero, cards, account, forms, order surfaces and green review palette. app/dark-theme.css provides the opt-in low-glare graphite palette; app/theme-control.tsx owns the light-default, local-only theme provider and toggle. |
| Link order | app/global-link-order.tsx |
| Cart and checkout/payment-test confirmation | app/shopping.tsx |
| Cart/order workflows, balance and pricing form component | app/order-workspace.tsx; the shared `PricingManager` is rendered centrally by `app/admin-view.tsx` |
| Copy order ID interaction | app/copy-text.tsx; localized clipboard action in expanded order details |
| Analytics, legal/readiness | app/prelaunch-views.tsx |
| Account/customs | app/account-views.tsx, app/customs/page.tsx |
| Identity/declaration/address help | app/identity-workspace.tsx, app/api/passport, lib/market/addresses.ts |
| Batch import/admin catalog, unified pricing and rules | app/batch-import.tsx, app/admin-view.tsx, app/catalog-admin.tsx, lib/market/catalog-editor.ts, lib/market/catalog-server.ts, lib/market/policy.ts |
| Client provider | lib/market/store.tsx |
| Auth/access | app/chatgpt-auth.ts, app/access-view.tsx, lib/market/access.ts |
| API | app/api/account, app/api/actions, app/api/import, app/api/catalog, app/api/internal/catalog-refresh, app/api/operations |
| Domain/security | lib/market/domain.ts, actions.ts, server.ts, world.ts |
| Importing | lib/importer/stores.ts, fetch.ts, extract.ts, shopify.ts |
| Database | db/schema.ts, drizzle/0000_overrated_justice.sql |
| Tests | tests/market.test.mjs, tests/world.test.mjs |

## Link import fallback and eBay

Automated merchant fetches remain restricted to exact allowlisted HTTPS storefront hosts, with redirect checks, request timeouts and response-size limits. A separate URL-shape validator accepts a public HTTPS product URL for a manual order without fetching an unsupported host; cart-add and checkout can skip a failed merchant check only after the customer marks the entered details as reviewed. The server still recomputes currency conversion, weight and quote fields. Unsafe URLs, credentials, ports, private IP literals and local hostnames are rejected.

`POST /api/actions` must preserve that manual-store boundary: cart-add validates the public URL and skips `fetchProduct()` only for a supported-host miss with explicit manual confirmation. Supported stores still go through live price/currency/option verification. Checkout applies the same rule to new items and treats the optional confirmation bit as true only for compatible legacy cart snapshots; all URLs are still revalidated and checkout recalculates pricing from server settings.

eBay country storefronts are explicitly listed. If public parsing, an eBay redirect, or a recoverable eBay response fails, customer link ordering receives the normal manual-entry form; a definitive not-found response remains an error. Operator batch import saves a reviewable draft from any partial public fields, or an empty draft when the listing is inaccessible. It never publishes that draft or replaces an existing item's saved data with an empty response. eBay automation is limited to data exposed by the public page; no challenge or access control is bypassed.

Nike's public `__NEXT_DATA__` parser matches the article code in the supplied product URL against the style/SKU or an exact Nike PDP path, including object-shaped `pdpUrl.url` and `pdpUrl.path`. It then reads sibling colorways only from that exact matching `productGroups` group; other groups are never selectable. Variant records retain each sibling's size ID/GTIN, price, color, availability signal and safe image for catalog review. The customer order-by-link view filters choices and its gallery to the exact URL-selected article/color. The gallery keeps one preferred rendition per source slot. Only USD men's shoes from Nike's `www.nike.com` storefront get the `Nike US men` size-system marker; the link-order UI uses that marker to label the size grid and link Nike's official conversion chart. Generic size labels and all saved cart/order schemas remain compatible.

The operator `/operations` queue continues to use its existing operator-protected `/api/operations` response and same-origin, revision-checked actions. Its order search reads already-returned order/account fields only; the expanded order panel separates account email/profile phone from the delivery recipient/phone. `mailto:` and validated `tel:` links require an explicit operator click and do not send email/SMS themselves. The profile phone is explicitly marked unverified. No new persisted fields, roles, staff authorization, or API write actions were added.

Operator catalog import applies the same safe fallback to any supported store when `fetchProduct` returns `ManualEntryFallbackError` or times out. The fallback may retain safe partial identity/image data but clears price, currency, variant prices and availability. Existing entries retain their saved fields when a recheck fails. The admin variant matrix permits explicit operator editing, while `catalogIssues` blocks publication if price/currency, variant label, or confirmed available option is missing. A manual operator assertion is not an automated merchant check; public listings must remain unpublished until reviewed.

Catalog descriptions no longer receive generated Atlas boilerplate. Known legacy boilerplate is omitted from public catalog projection and shown blank in the admin editor; custom descriptions remain untouched.

The `/admin` route is the single operator UI for catalog administration, rules, audit/system tools and centrally managed pricing. Global FX/freight/fees, actual-dispatch-country overrides, currency rates and the warehouse service catalogue are loaded and saved through the existing `app/api/operations` endpoints. Both the route content and API reads/writes require the primary operator configured by `ATLAS_OPERATOR_EMAIL`; the UI's staff directory does not grant access. `/operations` is reserved for order processing and no longer presents a duplicate tariff editor. Pricing remains versioned in the existing `market_settings.pricing` record, without a schema migration; orders retain their pricing snapshots.

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

The root `AtlasThemeProvider` uses `next-themes` with the root `data-theme` attribute, light as the initial default independent of the operating-system preference, and the device-local `atlas-theme` preference key. The localized `ThemeToggle` lives in the shared Marketplace header. Theme choice is presentational only and does not enter customer account state or server requests.

Catalog card rules are finalized in `app/experience.css` after the base catalog styles so the full card retains its surface, radius, image crop and text padding. Long product names and price rows may wrap within grid columns. `app/dark-theme.css` also themes the separate finds search/filter panel and its embedded controls; no catalog data or behavior changes.

Catalog filtering remains a client-side projection in `app/deals-feed.tsx` over the current published list: search and category chips stay visible, sort remains separate, and country/delivered-budget choices sit in a compact `details` panel. Active hidden filters are shown as removable chips; the displayed count excludes visible category/search controls and never renders as zero. `app/finds.css` provides the responsive light layout and `app/dark-theme.css` the graphite surfaces. This presentation layer does not change `filterDeals`, API requests, price formulas or persistence.

The public supported-store strip is an always-visible, localized section in `app/supported-stores.tsx`, not a disclosure or a second link-order callout. Keep one section heading, small store chips and one route to the complete `/stores` directory. Use Atlas forest green for Atlas actions/active controls; retain blue where it helps identify navigation or off-site merchant links. The graphite layer must supply its own readable surface, border, copy and semantic accent colors.

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

State contains orders, ledger entries, cart, favourites, checkout idempotency keys, saved recipient profiles, support-request history, an optional confirmed identity profile with masked passport number, test declarations, communication preferences, prepared email/SMS records and version. Order contains product snapshot, immutable quote, delivery snapshot, simulated payment, parcel/tracking events, assignment, staff notes, optional customer change requests, optional warehouse inspection, optional `warehouseServiceRequests` snapshots, status/history, both settlement types, approvals, quantity, balance use and customs consent. Cart lines optionally store `requestedServiceIds` and per-service `requestedServiceUnits`. Service requests optionally store a customer instruction note; change requests optionally mark an explicitly customer-approved proposed substitution as resolving a warehouse issue. These fields default compatibly for old stored carts/orders; no D1 migration is needed. Operator-entered internal notes remain separate from customer-facing notifications. A targeted operator notification is appended to the selected order owner's existing `notifications` array and references that order; it does not create a prepared email/SMS delivery or send an external message.

Warehouse services use the normal authenticated action path. At checkout the customer can flag `checkout`-stage preferences; checkout snapshots localized service text, unit, configured rate, dispatch country and request origin without changing the initial quote or authorizing work. After an order has warehouse inspection and remains at status 2 (before weighing), its owner can request a `warehouse`-stage offer. The server reads current enabled offers and country fee from managed pricing, snapshots the values, and rejects unknown/disabled/wrong-stage choices. An operator-only linked `change-request-create` checks the exact fixed price or records a quote; the customer must approve/decline the exact amount. An operator can also mark the request unavailable with a reason. `warehouse-service-complete` is operator-only and requires approval. Any requested, quoted or approved service blocks weighing until completed/declined; checkout preferences do not block purchase progression before arrival. Approved prices are represented by existing approved change requests and remain separate from the immutable quote. This is a pre-release workflow only: there is no connected warehouse execution or real additional charge, and “complete” is only a simulated status. Insurance cannot be enabled until insurer, coverage, exclusions and claims are verified.

Cart service-unit selections are optional and limited to enabled variable-unit checkout offers; the server validates unit type/count and `cartSignature` binds each selected count before checkout. Displayed fixed rates are per unit (and may use exact dispatch-country overrides); they are estimates of a requested later add-on and remain outside the initial payable total until an operator confirms feasibility and the customer approves its exact change request. The legacy `optionalServices` pricing field remains an unconditional general fee per cart line and is distinct from the warehouse-service catalogue. `special-request` requires an optional-schema, max-500-character customer note. For a damaged or mismatched warehouse inspection, `receiveOrder` accepts only a post-inspection approved substitution explicitly marked `resolvesWarehouseIssue` with a proposed replacement value; an unrelated `warehouse-service` change cannot clear the hold.

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
| POST /api/operations | operator identity + validated payload → order/support action (including a selected owner's in-app notification), customer access, projection rebuild, pricing, policy or staff-directory update + audit event |
| GET/POST /api/order-documents | owner/operator listing and download; operator-only private R2 upload for invoice, purchase proof and warehouse material |
| GET /api/backup | operator-only D1 JSON export with checksum and audit record; blob bytes excluded |
| GET /api/passport | authenticated identity → own document metadata only |
| POST /api/passport | identity + same origin + multipart image/PDF → private R2 object + D1 metadata |
| DELETE /api/passport?id=… | identity + same origin + ownership → delete private object and metadata |

Action types additionally include identity-confirm, identity-clear, declaration-preview, `cart-services`, `warehouse-service-request`, `warehouse-service-complete`, `warehouse-service-decline`, change-request-create, change-request-respond and warehouse-inspect. Identity confirmation requires an owner-scoped D1 passport record; the server masks the number before account persistence. Declaration snapshots are recomputed from confirmed state and selected server-side orders. Cart additions, service selection, quantities and checkout run against current server pricing and policy: category/keyword checks, count, weight and merchandise value. Assignment, staff notes, targeted `customer-notification`, parcel changes, change-request creation, warehouse inspection/completion/decline, advance, receive and merchant-shipping confirmation require operator on server. A manual notification is saved only to the account that owns the order ID supplied to `/api/operations`; action-schema validation, operator identity, same-origin checks, account revision checks and the audit event remain in the normal operator path. It is in-app only. Warehouse-service requests are owner-only; customer change responses run only in the owning account action route and compare the expected amount. Cross-customer actions additionally verify the target account revision. Cart checkout can invoke the existing `payment-demo` action directly in the cart success flow; it is not a real payment integration.

Linked products pass a source-freshness boundary in `/api/actions`: on cart addition and checkout the server fetches the allowlisted public page, resolves the stored optional merchant variant ID (or exact label fallback), and compares any published selected-option/product price and storefront currency before the domain action runs. This check never trusts client-supplied freshness timestamps and sends no store credentials. Customer cart and checkout never gate on stock signals; returned colour, size and other options remain selectable whether availability is true, false or unknown. If a merchant blocks or omits public data, the customer may explicitly confirm the visible price, currency and selected option and save the order request; any partial price/currency the merchant did return is still checked, and a reported mismatch or definite not-found response blocks it. A one-option product may use a neutral fallback label only when the live source exposes exactly one option, unless the customer explicitly confirms a manually entered option. Catalog rechecks retain a separate conservative stock policy; report and refresh markers remain optional fields in the existing versioned catalog JSON. Customer availability reports are also optional catalog fields, so old D1 documents remain valid without a migration. Reports cannot change the published snapshot; they flag the operator draft until a protected recheck or operator hide resolves them.

After a successful source-backed `cart-add`, the action route passes the verified importer snapshot to `addCustomerLinkDraft`. That helper canonicalizes the allowlisted source URL, performs an optimistic D1 catalog write only when no matching draft or published entry exists, and records a `catalog.customer-link` audit event. The result is a draft with a customer-demand review reason; it is intentionally not published or treated as Atlas inventory. A concurrent duplicate request is resolved by the catalog document's compare-and-swap revision, so the side effect is idempotent without weakening the account/cart transaction.

Catalog source observations have a second, non-customer path. Each entry may store optional due/attempt/success/error/status metadata and an auto-hide reason. `refreshDueCatalog()` selects at most five due cards from distinct source hosts, fetches with a global concurrency of two, rereads the D1 document before its compare-and-swap write, and records a system audit event. It can update a complete, explicitly in-stock source snapshot or unpublish a definitive all-sold-out matrix; it never hides on a failed, blocked or incomplete source response. The internal endpoint authenticates a `POST` with a five-minute HMAC timestamp/signature and holds a two-minute D1 lease. The current Sites artifact has no `scheduled` handler or cron trigger, so a separate scheduled Worker must call that endpoint with `ATLAS_CATALOG_REFRESH_SECRET`; no `setInterval` or user browser is treated as a scheduler.

When a public catalog card opens `/order-by-link?url=…`, the client auto-starts the protected import instead of asking the customer to submit the same URL again. It renders the imported colour/size/model matrix and preliminary calculation, then submits a normal `cart-add` action only after the customer confirms the selected combination. The link query is navigation context only: the action route repeats source verification before persisting the cart line. The public grid does not append separate client-only products: catalog administration, collections, favourites and ordering all resolve the same D1-backed catalog IDs and published snapshots.

The catalog card CTA is labeled “Add to cart” for all source-backed listings, including dated snapshots. This is an entry action, not a direct write from the card: it starts the protected fresh-import flow, and the order form still requires customer choice/confirmation plus server-side exact price and currency verification. A scheduled source refresh is a separate optional Worker in `workers/catalog-refresh/`; its config alone does not activate a trigger. Production activation requires matching Site/Worker HMAC secrets, a deployed Cron Worker and a verified successful invocation.

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

The customer account no longer exposes the browser-local legacy-state import panel. The `import-legacy` server action remains in the compatible action surface and is a pre-launch blocker before real payment, shipment or stored-value capability; removing the account UI does not remove or secure that backend path.

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

Customer transactional copy follows the same locale state: order cards and approval/settlement dialogs, balance, notification filters/settings and dynamic link-import status messages select RU/UZ/EN at render time. Canonical product names, merchant-provided descriptions, source URLs and server-authored history remain data, not machine-translated UI labels. Operator tools, legal body text and persisted server-authored history still need full localization; live API failure responses now use validated request locale and concise status-level copy.

## Conversion continuity and release safeguards — September 20, 2026

The catalog's manual-link form validates navigation context in the browser, then sends a guest through the existing safe `signInPath()` return route. After sign-in, `/order-by-link` still performs the protected import and the server repeats merchant/source verification before any cart action; the URL is not an authorization or pricing input.

The same form stores a bounded, non-sensitive session draft keyed by the requested source URL. It restores imported and edited values after a locale switch or route remount while the source freshness window is active; it never replaces the server-side verification or persists customer data to D1.

`AccountView` derives a non-destructive priority from the authenticated snapshot: customer approval, simulated payment, active order, non-empty cart, then missing recipient. Passport remains available through its existing protected workflow rather than being inserted ahead of a customer's immediate order task. The address form only uses the repository's local `addresses` lists through browser-native datalists; it introduces no external address-search request or new persisted field.

`MarketProvider` keeps short request failures in the currently selected locale. It writes the validated RU/UZ/EN preference to the display-only `atlas-language` cookie before API requests. `requestLocale()` accepts only this cookie value, then falls back to `Accept-Language`; neither value participates in authentication, authorization or account selection. `failure(error, request)` preserves stable `errorCode` values and localizes known `err_N` codes with the selected locale, while retaining detailed server messages in Russian for unknown/internal errors. Direct conflict responses and import fallback responses use the same mapping. HTTP status and the `{error}` response field remain compatible; detailed operator/legal text and historical messages are not translated by this layer.

Order-document download responses retain owner/operator authorization, attachment disposition and `private, no-store`; they now add `X-Content-Type-Options: nosniff`. This is endpoint-level hardening, not a substitute for deployment-wide response headers. At the Sites/Cloudflare edge, production must verify a CSP, frame protection, referrer policy and a global `nosniff` policy, and verify that `oai-authenticated-user-*` headers are injected by the trusted host and stripped from untrusted public requests.

Public catalog cards are built only from published, valid merchant snapshots. The seven-day observation lifetime suppresses stale price/availability confidence; by itself it does not remove an otherwise valid card. Other blocking validation issues or the absence of published entries can still produce an empty public catalog. When the API fails or returns no usable items, the client keeps a conservative local fallback and surfaces a retry path. `scripts/audit-ui.mjs` can exercise guest/account/permission/layout behavior in that fallback state and records skipped catalog-card checks; `ATLAS_AUDIT_REQUIRE_CATALOG=1` turns the same condition into an explicit release failure. A release still needs fresh, operator-reviewed D1 snapshots before browser flows that require a current merchant quote can pass.

For a published card whose merchant snapshot is past that seven-day window, `publicCatalog()` keeps a valid last-recorded source amount/currency for a clearly labelled preliminary estimate, but does not retain reference discounts, per-option prices or current-availability claims. The card's delivered estimate uses current Atlas rate/fee settings and the unknown-store-shipping reserve; the link-order flow remains the point at which an allowlisted merchant is fetched and checked. This is an estimate from an old observation, never a current store quote.

The 20 September 2026 editorial deal batch is direct-merchant by construction: Slickdeals may inform selection, but bundled products store only canonical allowlisted Amazon/eBay URLs and merchant-hosted images. The source observation date and expiry stay visible to the freshness/recheck pipeline; no aggregator URL is used for navigation, import or checkout.

For `amazon.com`, `fetchProduct` and collection reads use a request-scoped anonymous cookie jar. They force USD/English preferences, call Amazon's public delivery-location endpoint with ZIP `19701`, validate the returned `US` address, then fetch the page again and parse the US `corePrice` block. Amazon pages are allowed a separate bounded 6 MB HTML ceiling because their client-side state is larger; ordinary public pages retain the 3 MB ceiling. The authenticated import route bypasses its generic ten-minute cache for Amazon, so legacy or stale pre-US snapshots can never skip the location check. Cookies never cross users or persist in D1/R2. A failed location confirmation is a hard import failure, which prevents an Uzbekistan-IP price or delivery promise from entering a quote.

For `adidas.com` product URLs, the HTML route is treated as untrusted because Adidas may return an Akamai challenge to server requests. The importer first uses the bounded public PLP JSON for the URL's locale and slug (it carries the canonical card, price, gallery and `availableSizes`), then enriches it with same-host product JSON when available. Both responses must match the URL's exact article code before accepting data. Adidas rate-limits Chromium client-hint/XHR headers, so the adapter uses a minimal credential-free public header set and permits only the fixed `adidas.com` ↔ `www.adidas.com` edge redirect. Structured clothing/jersey labels map to the clothing category. It retries Adidas' fixed apex edge route when the `www` route is rate-limited and never turns a challenge/429 page into a successful empty import; if both public routes are unavailable, the customer receives the normal manual-entry fallback.

## Priority merchant importer contract — 22 September 2026

The importer uses `merchant-profiles.ts` as a metadata and observability registry for the first two merchant waves. It does not grant adapter permission by itself: `allowedUrl` remains the explicit HTTPS root allowlist, and `fetchProduct` remains the only public-fetch entry point with redirect, body, timeout, image and no-credential protections.

Structured product extraction is exact-listing-first. A Product/ProductGroup node is accepted only when its URL or offer URL matches the normalized source origin/path and safe product-defining query; unrelated recommendations are ignored. Variant IDs use a unique SKU/GTIN when available and otherwise retain label matching. The optional `availabilityKnown` flag distinguishes explicit in-stock/out-of-stock signals from pages that omit stock. Customer cart/checkout compare any live price, currency and exact option data but never gate on stock; an explicitly customer-confirmed order may proceed with a manually entered option when a merchant omits that matrix. Catalog refresh/publication continues to use availability independently.

An external scheduler can call `/api/internal/catalog-refresh` through `scripts/catalog-refresh.mjs`. The script signs `timestamp + POST + path` with `ATLAS_CATALOG_REFRESH_SECRET`; it is intentionally separate from Sites/Vinext because the current deployment has no cron trigger. No merchant login, CAPTCHA bypass, customer cookie or third-party credential is permitted.

## Priority merchant embedded fallback — 22 September 2026

`extractProduct` checks a small allowlisted set of priority-1/priority-2 origins for public JSON state scripts (`__NEXT_DATA__`, `__PRELOADED_STATE__`, `__INITIAL_STATE__`, and `__APOLLO_STATE__`) before the generic JSON-LD/Open Graph fallback. The candidate walker is bounded by payload size, depth and node count. It accepts a candidate only when a canonical URL/path or strong listing identifier matches the supplied source URL; recommendations and short generic numeric ids are ignored.

The adapter normalizes only merchant-published title, brand, category, price, currency, safe HTTPS images, SKU/GTIN, option labels, explicit availability, shipping and bounded weight. Missing availability is marked `availabilityKnown: false`, not treated as in stock. It never sends credentials or customer cookies, follows unapproved redirects, or attempts a CAPTCHA/login flow. A page with no exact embedded candidate continues through the generic parser and can still require manual entry.

ASOS uses a dedicated public-page parser because its product size map and `stockPriceResponse` are separate script assignments rather than a single JSON state object. The adapter requires the page product ID to equal `/prd/<id>`, then joins size records with stock/price rows by exact numeric variant ID. Missing joins remain unknown and cannot be treated as confirmed stock. A live check on 23 September 2026 returned a USD price, 8 sizes and one explicitly in-stock size; this is a point-in-time observation, not a guarantee of later availability.

`workers/catalog-refresh/` is intentionally a separate deployable Cloudflare Worker. Its scheduled handler calls the Site endpoint with Web Crypto HMAC headers and its health handler exposes no secret. The example configuration contains only the public Site URL; the shared secret must be provisioned independently in both runtimes before enabling the hourly trigger.

## GitLab CI preparation — 2026-09-26

The root `.gitlab-ci.yml` runs the repository's `install:ci`, lint, Node test suite and production build on Node 22. It includes GitLab-managed Dependency Scanning v2, SAST with Advanced SAST enabled for Ultimate, and pipeline Secret Detection. Security templates use GitLab's standard `test` stage. This pipeline has no deployment job, production credentials, D1 access or Sites integration.

GitHub remains the canonical source because Jules uses the GitHub repository. GitLab is intended as a one-way pull mirror and CI/security view. The GitLab project is not connected/configured in this checkout yet; mirror synchronization, pipeline validation, and security-dashboard findings remain unverified until the user authorizes the GitLab connector and selects the project. Do not push directly to the mirrored GitLab branch or turn on bidirectional mirroring.

## Jules PR source changes — 2026-09-26

`lib/importer/stores.ts` precomputes the existing explicit supported-host set (including only the same root, `www`, localized and configured `shop` hosts) so importer allowlist checks are constant-time without changing the security boundary. Deals Feed icon-only controls in `app/deals-feed.tsx` use the existing Radix tooltip primitive, with matching alignment in `app/experience.css`; checkout/payment pending states use the shared loader indicator. GitHub PR #2 was merged upstream and its source changes are integrated locally. PR #1 remains open upstream; its source changes are integrated locally for review, but have not been pushed.

## Import/API resilience — 2026-09-26

For Adidas, a blocked or malformed public JSON response may use the recoverable manual-entry path; exact article mismatches remain hard errors. Buyer-confirmed manual data may be saved when a public response is unavailable, while any returned price/currency mismatch and definite missing listing remain hard errors. Amazon's anonymous ZIP flow trusts only the parsed public location response (`isValidAddress === 1`, `countryCode === "US"`, exact ZIP `19701`); the subsequent product HTML need not render the postal code in a particular UI format. Failed or mismatched location responses remain hard failures. The Macy's adapter accepts only the exact `macys.com` host and a bounded, balanced JSON state block; missing stock is explicitly unknown, and a matching live merchant page has not yet been verified.

## Dark-theme styling

`app/dark-theme.css` is imported last from `app/layout.tsx` and is scoped to `html[data-theme="dark"]`. Its final graphite normalization maps legacy fixed light surfaces to shared surface, inset, hover, selected and semantic status tokens; keep the default light palette and UI/domain state independent. When adding a component with a fixed background, define both its foreground and border in this dark layer, and cover interactive, selected, disabled and warning/error states. Do not infer commercial readiness from visual status styling.

## iPhone responsive shell

`app/layout.tsx` declares `width=device-width`, `initialScale: 1` and `viewportFit: cover`. Mobile shell rules in `app/experience.css` use `env(safe-area-inset-top/bottom)` and `--atlas-mobile-nav-clearance` to keep fixed navigation, the cart action and the dismissible storage notice from colliding. Touch form controls use at least 16px text and 48px height to prevent iOS Safari focus zoom; navigation/card actions target 44px. On narrow screens, duplicated account/cart shortcuts are hidden from the header but remain in the persistent mobile navigation; notifications and operator access stay available.

`node scripts/audit-ui.mjs http://localhost:5173/` runs the dependency-free Chromium UI audit. It checks guest home at 360/390/402/430/800/1440px and authenticated account/cart/link-order at 390px. Responsive emulation does not replace physical iPhone Safari testing, particularly keyboard/visual-viewport, notch/home-indicator, VoiceOver and dark-mode behavior.

## September GitHub branch reconciliation — 2026-09-26

GitHub `main` through `3c06b83` is already contained in the Site source. The newer open PR and palette branch heads are treated as review inputs, not blanket merges. In particular, `market_staff_directory` does **not** grant API operator rights: only the authenticated email equal to `ATLAS_OPERATOR_EMAIL` does. This preserves the existing authorization boundary while staff identities and roles remain preparatory.

Sephora's `linkJSON` Product record passes through the existing generic structured-data parser only on the exact approved host and URL; it inherits safe-image handling, unknown-availability semantics and the authenticated import/cart verification gates. The client-only storage notice and deletion-confirmation controls add no new persisted account fields or server permissions. `workers/catalog-refresh/wrangler.toml` is a separate Worker deployment input, not part of the Sites application build; its schedule is inactive until the secret exists on both runtimes and the Worker is actually deployed.

## Operator catalog import and option metadata — 2026-09-27

- The operator importer remains a series of authenticated, same-origin single-item `POST /api/catalog` calls, each protected by the existing `ATLAS_OPERATOR_EMAIL` gate, per-user rate limit, source allowlist and version/CAS write. The UI batches at most ten unique links per pass. It retains failed/unprocessed URLs, reconciles lost responses/revision conflicts by re-reading the current document, and retries an item at most once; the API is not widened to a long-running multi-fetch transaction. Draft import still never publishes automatically.
- `CatalogDraft.variants` remains the D1 source of truth for each option's id, label, size, size label, color, merchant availability, price and safe image. The admin editor exposes this matrix and the gallery for review.
- The public `Product` schema adds optional `sourceVariants` and `sourceImages`. Existing products/orders without them still parse. `publicCatalog()` sanitizes image URLs and forwards the option matrix; when the snapshot is stale it strips per-option prices and marks availability unknown while retaining labels/IDs for explicit manual fallback. Existing `variants: string[]` remains unchanged for legacy consumers.
- These optional client-visible fields are selection/display metadata only. Action APIs continue to re-fetch merchant data, verify price/currency/selected option when the source responds, and recompute all quote values on the server. They are not accepted as payment or delivery authority.

## Planned custom domain — 2026-09-27

`atlasmarket.uz` is the intended customer domain, not a verified current origin. The Site is still live on `atlas-uz-market.ishakovzakir0.chatgpt.site`; canonical metadata, structured data, robots, sitemap, `llms.txt` and the refresh-worker base URL must stay on that working origin until the Sites custom-domain mapping, DNS and HTTPS are confirmed. After activation, update those sources as one cutover and verify redirects/canonical URLs; do not change DNS or canonical origin from the code-only step.

## US-first merchant adapter coverage — 2026-09-27

`priorityMerchantProfiles` is the single profile source for the 15-store US-first priority set and drives priority embedded-state parsing. `supportedStoreRoots` remains the separate explicit SSRF allowlist and also includes the Spain regional storefronts `sephora.es` and `es.victoriassecret.com`; adding `victoriassecret.com` does not create wildcard sibling-subdomain access. The directory lists each storefront separately so a US `.com` product link is never silently substituted for the Spain link (or vice versa).

Extraction remains layered: fixed merchant adapters (for example Amazon location context, adidas public JSON, Nike state, Macy's state) run before bounded exact-source embedded JSON and JSON-LD/Open Graph parsing. Sephora US/Spain's nonstandard `linkJSON` is admitted only on those exact hosts and only when the product's canonical/offer URL matches the supplied listing. A matched `ProductGroup` can contribute its no-URL child option records, but unrelated nodes with their own listing URL are not merged into its options. Named option axes include shade/color, size/format/volume, and bra band/cup. Existing unknown-stock semantics and safe-image/URL checks are unchanged.

This is compatibility coverage, not a guarantee of merchant access. Public pages that return 403, bot challenges, incomplete state or no variant matrix use the recoverable manual-entry path; price/currency and the selected option still follow the existing user-confirmation/server-recalculation rules. Do not bypass access controls. Current live checks from the development network were blocked for Sephora and Victoria's Secret, so only synthetic adapter contract fixtures pass locally; secure authorized live fixtures remain outstanding.

## Mutation response latency — 27 September 2026

`account()` batches the compatible platform-ID migration and email-key initialization statements before reading the account snapshot. The JSON account remains canonical. `persist()` still waits for its owner-scoped compare-and-swap update to `market_accounts`, then schedules the rebuildable `market_customers` / order / fee / event projection with Cloudflare `waitUntil` rather than waiting for that secondary batch before replying. The background task rereads the latest saved account revision, applies the projection, and checks the revision again; if another mutation won concurrently, it retries against the newer snapshot (up to three attempts). Projection failures are logged and remain repairable from `/admin`.

After a source-backed cart addition has been verified and saved, `addCustomerLinkDraft()` is likewise registered with `waitUntil`; its canonical-URL/CAS behavior remains idempotent and customer-visible cart state does not depend on the admin review draft. The linked source fetch/price-currency-option comparison, domain action, and canonical account CAS remain on the response path. When the public merchant cannot provide data, the existing explicit customer-confirmed fallback applies; latency must not be reduced by treating stale browser/catalog data as a current quote.

## Route and read-path performance — 27 September 2026

- Heavy route views (link import, cart, account, orders, identity, operator screens and related tools) are React-lazy modules behind a localized Suspense boundary. Catalog and favorites remain in the eagerly needed storefront path.
- The catalog request is explicitly loaded only on the catalog route or authenticated favorites route and deduplicated while a request is in flight. It is no longer fetched on unrelated account, cart, order or admin routes. The public catalog API and its cache policy are unchanged.
- `GET /api/account` reads an existing D1 account without issuing initialization writes. Legacy platform-ID migration and default-account creation remain supported on a missing-row path with idempotent inserts.
- Account/action/operator endpoints fetch pricing and policy settings in one D1 query; response shapes and fallbacks remain unchanged.
- Do not move merchant price/option checks, account CAS writes, or server-side quote recomputation out of the authorized action path. Remaining large shared client/runtime and global CSS assets are recorded in `TODO.md` for measurement-led follow-up.

## Link-order quote presentation and customs note — 29 September 2026

- The cart and order-by-link cost display group the existing service, buyout, conversion, international delivery and delivery-margin amounts under one “Atlas service” headline with an accessible on-demand component breakdown. Store shipping, refundable reserve and the general Atlas fee remain distinct. This is presentation-only: quote properties, `price()`, server-side totals, stored orders/carts and Zod schemas are unchanged.
- The weight/shipping explanation is an on-demand disclosure beside international delivery. Its popover resets inherited `white-space: nowrap` from quote-amount cells so long localized guidance wraps within its viewport-bounded width; the outer quote disclosure's spacing selector must not target nested summaries. The order-by-link and product-card views omit customs calculations; the cart conditionally shows the informational estimate only when merchandise exceeds the configured $200 monthly allowance, while `/customs` retains the detailed input form. It remains separate from Atlas totals and is not a carrier quote.
- The calculator currently follows the consolidated PP-4508 rate text (20% and a $2/kg minimum from 1 September 2026), while UP-174 §8 separately states 1 January 2027. This legal effective-date conflict is a known issue; do not present this estimate as a binding duty quote or commercial tariff before Customs confirms the effective date.

## Catalog review queue and resilient importer — 27 September 2026

- `CatalogEntry.createdAt`, `origin`, and `queueState`, plus `CatalogDraft.importFailureReason`, are optional versioned JSON fields. Old D1 catalog records continue to parse; no SQL migration is required.
- Operator imports and customer link orders are queued as private drafts. The admin view separates new queue, currently published, earlier/archived entries and all records; selection actions operate on explicit IDs and are written to the existing catalog audit stream.
- Hard-delete is restricted to unpublished, non-bundled drafts. Published and bundled products remain recoverable through hide/unpublish; order snapshots and customer carts are not changed by catalog draft deletion.
- Merchant request/parser/network failures can be represented as manual-review drafts with unknown price and availability. Manual entry does not bypass the existing live exact-variant, price and currency checks on cart/checkout.
- Shopify products with only per-variant prices remain importable without inventing a base price. Generic HTML parsing accepts XHTML. Redirects outside the allowlist become a manual path without following the destination.
- Allowlisting a store root does not imply a dedicated adapter or reliable extraction. Live behavior across all supported stores is still unverified; do not state that every store auto-imports perfectly.

## Admin/catalog interaction changes — 29 September 2026

- `CatalogAdmin` retains the existing authenticated `/api/catalog` mutation flow and D1-backed catalog document. A bulk recheck uses sequential chunks no larger than the unchanged API limit of ten IDs; each response revision feeds the next request. A failed chunk leaves the remainder selected so the operator can retry.
- Admin import remains draft-only. The UI starts at most 16 source imports per launch, under the API's rate limit, and removes only successfully saved URLs from the text queue. Empty manual collection selection can inherit the most-used collections for the same source host. RU/UZ/EN templates are static presets; no machine-translation service is present.
- Every published catalog card renders the existing order CTA, which enters the live, server-validated price/variant flow. Customer-link entries and admin imports are not auto-published. Public purchase availability is an order request workflow, not guaranteed merchant inventory or completed payment/fulfilment.
- Scheduled refresh source exists separately under `workers/catalog-refresh`; no schedule or secret was deployed/verified in this change. Manual refresh UI must not be described as automatic background operation. Only definitive all-options-out-of-stock evidence auto-hides a card, and it preserves the underlying draft.
- Finance display derives grouped totals from immutable saved order quote snapshots and simulated payment statuses. It does not represent recognized Atlas revenue or settled provider transactions. Audit filters are constrained to the latest 100 events returned by `/api/operations`; customer clicks/messages are not present and must not be inferred from administrator events.
- Per-country rate overrides are a collapsed UI disclosure only; server settings schema, effective pricing and existing-order snapshots are unchanged. The public home filters are client-side refinements over the already loaded public catalog.

## Refund cases, route metadata, and local performance samples — 29 September 2026

- `Order.issueCase` is optional versioned JSON with category, status, optional proposed UZS amount, update time and at most 40 events. Legacy orders parse without it; no D1 migration is needed. `order-issue-update` is operator-only through the authenticated, same-origin, revision-checked operations route and is included in the audit log.
- Proposed refund amounts are case-management data only. They do not issue a payment-provider refund, write a ledger entry, change simulated payment status or alter the order quote. Cancelled orders with unresolved cases remain in the operator-attention queue. Internal notes and targeted in-app notifications remain separate records.
- `PerformanceProbe` records coarse route-group Core Web Vitals and same-origin API durations in browser-local storage only. It keeps 20 recent samples; no API path, customer identifier, response body or telemetry request is persisted or sent. The admin system tab labels the summary as local p75, not site-wide analytics.
- Route metadata sets canonical/Open Graph URLs for public catalog, customs, legal and store-directory pages, and disables indexing for account/operator/order-entry screens. `robots.txt` separately excludes private and link-order paths; route metadata is not an authorization boundary.
- Single unique colorway labels are rendered as static merchant options; slash-separated merchant descriptors are not inferred to be separate colors. A different color requires its own source listing URL. Multiple real sibling options remain selectable only when the adapter returns them as distinct product variants.
