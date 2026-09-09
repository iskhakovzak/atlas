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
| Account/customs | app/account-views.tsx, app/customs/page.tsx |
| Client provider | lib/market/store.tsx |
| Auth | app/chatgpt-auth.ts |
| API | app/api/account, app/api/actions, app/api/import |
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

State contains orders, ledger entries, cart, favourites, checkout idempotency keys and version. Order contains product snapshot, immutable quote, status/history, both settlement types, approvals, quantity, balance use and customs consent.

## APIs

| Endpoint | Contract |
| --- | --- |
| GET /api/account | identity → user, state, revision |
| POST /api/import | identity + same origin + URL → Extracted data, 12/min |
| POST /api/actions | identity + same origin + action/revision → next state |

Action types: favorite, order-image, cart-add, cart-quantity, cart-remove, cart-renew, checkout, advance, receive, confirm-store-shipping, approve-extra, approve-store-shipping-extra, cancel and import-legacy. advance, receive and confirm-store-shipping require operator on server.

## Environment and services

| Value | Use |
| --- | --- |
| DB | Required D1 binding |
| ATLAS_OPERATOR_EMAIL | Optional Worker secret granting operator role |
| BUCKET | Declared but unused |

No payment processor, eBay API, carrier/tracking API, FX API, email/SMS provider or product cache exists.

## Security

- Identity only from request headers on server.
- Same-origin write/import routes.
- Maximum 1 MB JSON account state.
- Zod action schemas and server recalculation.
- Merchant allowlist and redirect validation.
- Time/body caps, captcha detection and safe image validation.
- No cookies/auth sent to stores.

## Deployment

.openai/hosting.json currently points to ChatGPT Sites project appgprj_6aa181097a00819196698407b43a6a45 and maps D1 binding DB. Hosted site is private owner-only.

Current deployment procedure: commit; request temporary Sites repo credential; push exact HEAD; package site; save a version with exact pushed SHA; deploy saved version privately; poll success. Never persist the temporary token.

Last handoff verification passed npm run lint, Node tests and npm run build. Tests total: 20.
