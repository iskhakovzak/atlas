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
| Deals-first feed/favourites | app/deals-feed.tsx, app/finds.css, lib/market/deals.ts, lib/market/deal-copy.ts, lib/market/catalog.ts; dated merchant records, pricing and authenticated favourite action |
| Shared Atlas visual system | app/atlas-design.css, loaded after base styles in app/layout.tsx; navy/blue/lime palette, responsive hero, cards, account, forms and order surfaces |
| Link order | app/global-link-order.tsx |
| Cart | app/shopping.tsx |
| Orders, operations, balance | app/order-workspace.tsx |
| Analytics, legal/readiness | app/prelaunch-views.tsx |
| Account/customs | app/account-views.tsx, app/customs/page.tsx |
| Identity/declaration/address help | app/identity-workspace.tsx, app/api/passport, lib/market/addresses.ts |
| Batch import/admin rules | app/batch-import.tsx, app/admin-view.tsx, lib/market/policy.ts |
| Client provider | lib/market/store.tsx |
| Auth/access | app/chatgpt-auth.ts, app/access-view.tsx, lib/market/access.ts |
| API | app/api/account, app/api/actions, app/api/import, app/api/operations |
| Domain/security | lib/market/domain.ts, actions.ts, server.ts, world.ts |
| Importing | lib/importer/stores.ts, fetch.ts, extract.ts |
| Database | db/schema.ts, drizzle/0000_overrated_justice.sql |
| Tests | tests/market.test.mjs, tests/world.test.mjs |

## Runtime flow

~~~mermaid
flowchart TD
  UI[React UI] --> Provider[MarketProvider]
  Provider --> Account[GET api account]
  UI --> Import[POST api import]
  UI --> Actions[POST api actions]
  Account --> Auth[ChatGPT headers]
  Import --> Auth
  Actions --> Auth
  Import --> Fetch[Allowlisted public fetch]
  Fetch --> Parse[Generic ProductGroup or Zara extractor]
  Actions --> Domain[Typed domain action]
  Account --> D1[(D1)]
  Actions --> D1
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

market_settings stores the current versioned pricing JSON and update identity. market_import_cache stores allowlisted extracted product payloads for ten minutes.

market_identity_documents stores owner, private R2 object key, safe file metadata, confirmation status and confirmed JSON. Passport bytes are stored in private BUCKET R2 and never exposed through a public URL.

market_settings also stores a versioned `policy` JSON setting. It defines server-authorized import/cart restrictions and has no client-side source of truth.

Migration 0004 adds the normalized launch foundation: `market_customers`, `market_order_records`, `market_order_fee_lines`, `market_order_events`, `market_legal_consents`, `market_staff_directory` and `market_audit_events`. Existing `market_accounts` JSON remains the compatible customer-flow source; every successful write now maintains an idempotent operational projection of customers, orders, fee lines and status events. The projection is rebuildable from `/admin` and is safe to reconcile if a secondary write fails. Staff-directory rows do not grant access; `ATLAS_OPERATOR_EMAIL` remains the sole authorization source.

State contains orders, ledger entries, cart, favourites, checkout idempotency keys, saved recipient profiles, support-request history, an optional confirmed identity profile with masked passport number, test declarations, communication preferences, prepared email/SMS records and version. Order contains product snapshot, immutable quote, delivery snapshot, simulated payment, parcel/tracking events, assignment, staff notes, status/history, both settlement types, approvals, quantity, balance use and customs consent.

## APIs

| Endpoint | Contract |
| --- | --- |
| GET /api/account | identity → user, state, revision |
| POST /api/import | identity + same origin + URL → Extracted data, 12/min |
| POST /api/actions | identity + same origin + action/revision → next state |
| GET /api/operations | operator identity → customer/support queues, pricing, policy, projection health, staff directory and audit events |
| POST /api/operations | operator identity + validated payload → order/support action, customer access, projection rebuild, pricing, policy or staff-directory update + audit event |
| GET /api/passport | authenticated identity → own document metadata only |
| POST /api/passport | identity + same origin + multipart image/PDF → private R2 object + D1 metadata |
| DELETE /api/passport?id=… | identity + same origin + ownership → delete private object and metadata |

Action types additionally include identity-confirm, identity-clear and declaration-preview. Identity confirmation requires an owner-scoped D1 passport record; the server masks the number before account persistence. Declaration snapshots are recomputed from confirmed state and selected server-side orders. Cart additions, quantities and checkout run against the current server policy: category/keyword checks, count, weight and merchandise value. Assignment, staff notes, parcel changes, advance, receive and merchant-shipping confirmation require operator on server. Cross-customer actions additionally verify the target account revision.

## Environment and services

| Value | Use |
| --- | --- |
| DB | Required D1 binding |
| ATLAS_OPERATOR_EMAIL | Optional Worker secret granting operator role |
| BUCKET | Private R2 storage for owner-scoped passport scans |

No payment processor, eBay API, carrier API, automatic FX API, email/SMS provider or standalone identity provider exists. Payment webhooks, tracking and external messages are safely represented inside Atlas for the pre-release demo only. FX/tariffs are operator-managed and product imports have a short D1 cache.

## Security

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
