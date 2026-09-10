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
| Link order | app/global-link-order.tsx |
| Cart | app/shopping.tsx |
| Orders, operations, balance | app/order-workspace.tsx |
| Analytics, legal/readiness | app/prelaunch-views.tsx |
| Account/customs | app/account-views.tsx, app/customs/page.tsx |
| Identity/declaration/address help | app/identity-workspace.tsx, app/api/passport, lib/market/addresses.ts |
| Client provider | lib/market/store.tsx |
| Auth | app/chatgpt-auth.ts |
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
  Fetch --> Parse[Generic or Zara extractor]
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

State contains orders, ledger entries, cart, favourites, checkout idempotency keys, a saved delivery profile, an optional confirmed identity profile with masked passport number, test declarations, communication preferences, prepared email/SMS records and version. Order contains product snapshot, immutable quote, delivery snapshot, simulated payment, parcel/tracking events, assignment, staff notes, status/history, both settlement types, approvals, quantity, balance use and customs consent.

## APIs

| Endpoint | Contract |
| --- | --- |
| GET /api/account | identity → user, state, revision |
| POST /api/import | identity + same origin + URL → Extracted data, 12/min |
| POST /api/actions | identity + same origin + action/revision → next state |
| GET /api/operations | operator identity → all customer queues + current pricing |
| POST /api/operations | operator identity + target revision → order action or pricing update |
| GET /api/passport | authenticated identity → own document metadata only |
| POST /api/passport | identity + same origin + multipart image/PDF → private R2 object + D1 metadata |
| DELETE /api/passport?id=… | identity + same origin + ownership → delete private object and metadata |

Action types additionally include identity-confirm, identity-clear and declaration-preview. Identity confirmation requires an owner-scoped D1 passport record; the server masks the number before account persistence. Declaration snapshots are recomputed from confirmed state and selected server-side orders. Assignment, staff notes, parcel changes, advance, receive and merchant-shipping confirmation require operator on server. Cross-customer actions additionally verify the target account revision.

## Environment and services

| Value | Use |
| --- | --- |
| DB | Required D1 binding |
| ATLAS_OPERATOR_EMAIL | Optional Worker secret granting operator role |
| BUCKET | Private R2 storage for owner-scoped passport scans |

No payment processor, eBay API, carrier API, automatic FX API or email/SMS provider exists. Payment webhooks, tracking and external messages are safely represented inside Atlas for the pre-release demo only. FX/tariffs are operator-managed and product imports have a short D1 cache.

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

.openai/hosting.json currently points to ChatGPT Sites project appgprj_6aa181097a00819196698407b43a6a45 and maps D1 binding DB. Hosted site is private owner-only.

Current deployment procedure: commit; request temporary Sites repo credential; push exact HEAD; package site; save a version with exact pushed SHA; deploy saved version privately; poll success. Never persist the temporary token.

The verification suite includes lint, Node domain/security tests, production build, a dependency-free public browser smoke test and an authenticated API smoke covering checkout, payment, assignment, parcel, tracking, warehouse and email/SMS previews.
