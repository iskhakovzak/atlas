# Atlas: first executable product slice

Based on the supplied Cross-border Marketplace Uzbekistan Blueprint and Funds, Weight & Settlement supplement.

## Delivered
- Russian responsive catalog with category/search/price ordering.
- HTTPS link entry with explicit manual fallback; no scraping or server-side URL fetching.
- Immutable 15-minute quote in integer UZS; merchandise, service, shipping and reserve separate.
- Variant selection and simulated checkout.
- Order history and controlled sequence: purchase → warehouse → settlement → shipment → delivery.
- Warehouse billable weight = max(actual kg, dimensions cm / 5000).
- Unused prepaid shipping and reserve returns to demo customer credit.
- Excess shipping blocks dispatch until customer explicitly confirms simulated extra payment.
- Locally persisted orders and paired debit/credit refund records.

## Boundaries
This is a browser-local functional prototype, not the production MVP described in the blueprint. Private Site access is provided by hosting; customer authentication and operator RBAC are not implemented. Customer/operator screens share the same browser state. Users can manipulate local data; it is not an authoritative financial ledger. No actual payment, merchant integration, live FX, customs assessment, address/passport collection, notifications or shipping integration occurs. Catalog photos are illustrative category images; prices, variants and availability are fictional.

Balances cannot fund another order or be withdrawn. A ledger record exists only for demo reserve refunds; full double-entry accounting, funding provenance, capture/release accounts, transactional outbox and reconciliation still need backend implementation. Warehouse evidence photos are not captured.

## Next production slice
1. Confirm agent/reseller model, logistics partner, source stores and PSP; obtain actual tariff/FX inputs.
2. Modular monolith and PostgreSQL with auth/RBAC, immutable PriceQuote, idempotent Order/Payment, append-only history, audit log and ledger, following the source architecture. Current Sites Worker is only the hosted prototype shell, not a replacement for that architecture.
3. One authorized source adapter plus manual operations fallback; no arbitrary URL-fetch endpoints.
4. PSP sandbox, signed/idempotent webhooks and transaction reconciliation.
5. Receiving evidence, settlement caps, refunds tied to payment provenance.
6. Production privacy/security/financial checks and limited real-order pilot.

## Validation performed
Production build; domain assertions for quote sum/TTL/immutability, dimensional weight dominance, refund/extra-payment branches and invalid numeric input. Browser UI testing has not been performed.
