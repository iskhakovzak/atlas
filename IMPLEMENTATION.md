# Atlas — executable marketplace prototype

Based on the supplied Cross-border Marketplace Uzbekistan Blueprint and Funds, Weight & Settlement supplement. The product remains a private browser-local prototype, not a production marketplace.

## Current experience

- Responsive catalog, delivered-price sorting, text/category filters, favorites and mobile bottom navigation.
- Product detail sheet with variant selection, description, pricing breakdown and useful source links.
- Link-to-order using an explicit manual fallback: validated HTTPS source, name, price, weight, variant. Source URL is retained through cart and order.
- Persistent cart with quantities, removal, merging of matching variants, and a visible 15-minute quote expiry. Changing quantity or explicitly refreshing creates a new quote.
- Review and confirmation before simulated checkout. Multiple lines create individual orders in a common checkout batch.
- Simulated credits can reduce the checkout payment. No payment-card details are collected.
- Order filtering/search, itemized original pricing, quantity, status timeline and timestamped history.
- Cancellation before purchase returns the full simulated total to customer credit once.
- Operator workspace with workload counts, guarded status transitions and live warehouse settlement preview.
- Shipping charged on max(actual weight, dimensional weight). The quote snapshots the shipping tariff/divisor so later configuration changes cannot alter the order's original tariff.
- Unused shipping/reserve is credited once. Additional shipping costs block dispatch until explicit customer confirmation.
- Balance lists credits and debits; reserves on cancelled or settled orders are excluded.

## Reliability

- Domain actions separated from UI in `lib/market/domain.ts`.
- Common React context persists across navigation. Existing `atlas-market-demo-v1` local data is migrated in memory with Zod defaults, keeping original order IDs, quotes, history and credit entries.
- Invalid saved data is not overwritten. Storage errors leave actions unavailable rather than reporting a successful save.
- Storage events refresh other tabs. Writes read current data and use the Web Locks API where available. This is not backend concurrency control.
- Checkout batch keys make repeated checkout idempotent. Cart signature checks prevent confirming a cart changed in another tab. Money-changing actions re-read and validate current order state.
- Single entry per cancellation and warehouse refund. State and related credit records are persisted together as one local JSON value.
- Reduced-motion support, accessible primitive dialogs/sheets/tabs/selects/checkboxes, labeled icon actions and responsive control layout.

## Boundaries

Private Site access is supplied by hosting. Customer authentication, operator RBAC and a server database are not implemented. Customer and operator views use the same local browser data; it is editable by the visitor and is not an authoritative financial ledger.

Catalog photos illustrate categories. Prices, variants, source currency conversion, shipping tariffs and availability are demonstration values. No live scraping, source purchase, bank payment, shipping integration, customs assessment, address/passport collection or notifications occur. No delivery dates are promised. Warehouse evidence photos are not captured. No real funds can be topped up or withdrawn.

Credit records are paired debit/credit movements in a simulation, not a complete production double-entry ledger: payment provenance, outbox, provider settlement, hold/capture accounts and reconciliation remain backend work.

## Validation

`node --experimental-strip-types --test tests/market.test.mjs` covers:
- Pricing bounds, quantities and itemized totals.
- Legacy state migration and malformed-data rejection.
- Cart merging/variants and retained source URLs.
- Quote expiry, changed-cart rejection and checkout idempotency.
- Immutable quotes, tariff snapshots and single warehouse refunds.
- Dimensional weight and blocked dispatch until extra-payment approval.
- Pre-purchase cancellation, single refunds and credit spending/recovery.
- Rejection of unsafe source URLs.

TypeScript validation and production build are required before saving. Browser UI testing has not been performed.

## Next production slice

Confirm commercial model, logistics partner, source stores and PSP; replace demo tariffs with approved inputs. Implement the source blueprint's modular backend with PostgreSQL, authentication/RBAC, immutable quotes, idempotent payment webhooks, audit history, ledger and outbox. Connect one authorized source adapter and PSP sandbox, then add receiving evidence and reconciliation before any real-order pilot.
