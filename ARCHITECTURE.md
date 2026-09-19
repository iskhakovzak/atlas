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
| Cart | app/shopping.tsx |
| Orders, operations, balance | app/order-workspace.tsx |
| Analytics, legal/readiness | app/prelaunch-views.tsx |
| Account/customs | app/account-views.tsx, app/customs/page.tsx |
| Identity/declaration/address help | app/identity-workspace.tsx, app/api/passport, lib/market/addresses.ts |
| Batch import/admin catalog/rules | app/batch-import.tsx, app/admin-view.tsx, app/catalog-admin.tsx, lib/market/catalog-editor.ts, lib/market/catalog-server.ts, lib/market/policy.ts |
| Client provider | lib/market/store.tsx |
| Auth/access | app/chatgpt-auth.ts, app/access-view.tsx, lib/market/access.ts |
| API | app/api/account, app/api/actions, app/api/import, app/api/catalog, app/api/operations |
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

Migration 0004 adds the normalized launch foundation: `market_customers`, `market_order_records`, `market_order_fee_lines`, `market_order_events`, `market_legal_consents`, `market_staff_directory` and `market_audit_events`. Existing `market_accounts` JSON remains the compatible customer-flow source; every successful write now maintains an idempotent operational projection of customers, orders, fee lines and status events. The projection is rebuildable from `/admin` and is safe to reconcile if a secondary write fails. Staff-directory rows do not grant access; `ATLAS_OPERATOR_EMAIL` remains the sole authorization source.

State contains orders, ledger entries, cart, favourites, checkout idempotency keys, saved recipient profiles, support-request history, an optional confirmed identity profile with masked passport number, test declarations, communication preferences, prepared email/SMS records and version. Order contains product snapshot, immutable quote, delivery snapshot, simulated payment, parcel/tracking events, assignment, staff notes, optional customer change requests, optional warehouse inspection, status/history, both settlement types, approvals, quantity, balance use and customs consent. New fields remain optional so existing stored orders parse without a migration.

## APIs

| Endpoint | Contract |
| --- | --- |
| GET /api/account | identity → user, state, revision |
| POST /api/import | identity + same origin + URL → Extracted data, 12/min |
| GET /api/catalog | public published catalog, or operator-only full draft document with `?admin=1` |
| POST /api/catalog | operator identity + same origin + document revision → import/discover/edit/publish/hide/collection command + audit event |
| POST /api/catalog-availability | customer identity + same origin + rate limit + exact catalog ID/source → persisted available/unavailable report and operator-review marker |
| POST /api/actions | identity + same origin + action/revision → next state |
| GET /api/operations | operator identity → customer/support queues, pricing, policy, projection health, staff directory and audit events |
| POST /api/operations | operator identity + validated payload → order/support action, customer access, projection rebuild, pricing, policy or staff-directory update + audit event |
| GET/POST /api/order-documents | owner/operator listing and download; operator-only private R2 upload for invoice, purchase proof and warehouse material |
| GET /api/backup | operator-only D1 JSON export with checksum and audit record; blob bytes excluded |
| GET /api/passport | authenticated identity → own document metadata only |
| POST /api/passport | identity + same origin + multipart image/PDF → private R2 object + D1 metadata |
| DELETE /api/passport?id=… | identity + same origin + ownership → delete private object and metadata |

Action types additionally include identity-confirm, identity-clear, declaration-preview, change-request-create, change-request-respond and warehouse-inspect. Identity confirmation requires an owner-scoped D1 passport record; the server masks the number before account persistence. Declaration snapshots are recomputed from confirmed state and selected server-side orders. Cart additions, quantities and checkout run against the current server policy: category/keyword checks, count, weight and merchandise value. Assignment, staff notes, parcel changes, change-request creation, warehouse inspection, advance, receive and merchant-shipping confirmation require operator on server. Customer change responses run only in the owning account action route and compare the expected amount. Cross-customer actions additionally verify the target account revision.

Linked products pass an additional source-freshness boundary in `/api/actions`: the server fetches the allowlisted public page on cart addition and checkout, resolves the stored optional merchant variant ID (or exact label fallback), and compares availability, currency and source price before the domain action runs. This check never trusts client-supplied freshness timestamps and sends no store credentials. Catalog rechecks use the same bounded importer; change and error markers remain optional fields in the existing versioned catalog JSON. Customer availability reports are also optional catalog fields, so old D1 documents remain valid without a migration. Reports cannot change the published snapshot; they flag the operator draft until a protected recheck or operator hide resolves them.

When a public catalog card opens `/order-by-link?url=…`, the client auto-starts the protected import instead of asking the customer to submit the same URL again. It renders the imported colour/size/model matrix and preliminary calculation, then submits a normal `cart-add` action only after the customer confirms the selected combination. The link query is navigation context only: the action route repeats source verification before persisting the cart line. The public grid does not append separate client-only products: catalog administration, collections, favourites and ordering all resolve the same D1-backed catalog IDs and published snapshots.

Pricing stores base international freight and delivery margin separately. International freight uses at least 1 kg per merchant parcel. During every cart add, quantity change and quote renewal, linked lines with the same normalized source host and dispatch country are repriced together: boxed weights are summed, the 0.3 kg packaging and 0.2 kg safety allowance are added once, and freight/reserve/delivery margin are allocated back to the line quotes so checkout and later order snapshots remain additive and immutable. Operational projection uses the current payable amount and creates separate fee lines for approved change requests while the original quote remains untouched. Warehouse receiving requires a saved inspection; damaged or mismatched intake needs an approved resolution created after that inspection.

## Environment and services

| Value | Use |
| --- | --- |
| DB | Required D1 binding |
| ATLAS_OPERATOR_EMAIL | Optional Worker secret granting operator role |
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

