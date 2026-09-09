# Atlas TODO and known limitations

## Required before commercial launch

- [ ] Add compliant real payment, provider webhook, refunds and reconciliation. Demo balance is not money.
- [ ] Replace static FX and tariff constants with versioned live/managed data.
- [ ] Build cross-customer operator queue, staff roles, audit trail and assignment.
- [ ] Move from per-account JSON state to proper relational orders/ledger with migration, outbox and reconciliation.
- [ ] Re-verify Uzbekistan customs rules, legal/privacy requirements and recipient-limit model.
- [ ] Integrate actual carrier routes, tracking, volumetric rules and notifications.

## Importing

- [ ] Add store-specific adapters from real test URLs. Zara is current detailed adapter; generic JSON-LD/OG is best effort.
- [ ] Add authorized eBay Browse API if reliable eBay sourcing is needed. No credential/adapter exists.
- [ ] Add caching, source timestamp and expiry for imports.
- [ ] Improve option matrix: colour → valid size → price → stock; current UI uses a flat variant list.
- [ ] Support multi-image gallery and stronger variant image switching for more stores.
- [ ] Test the allowlist against live pages regularly. Store HTML and bot behavior change.

## Order flow

- [x] Make manager merchant-shipping confirmation clearer in customer order UI; show actual USD and UZS.
- [ ] Add customer approval for changed item price, unavailable item and substitutions.
- [ ] Define combined-shipping logic for multiple units; source shipping currently multiplies per quantity.
- [ ] Define post-purchase cancellation/refund rules. Current automatic cancellation is status 0 only.
- [ ] Add manager invoice/evidence uploads before actual financial adjustments.

## Auth/data/operations

- [ ] Decide on ChatGPT-only auth versus standalone customer registration.
- [ ] Document/test production D1 migration from local machine before schema changes.
- [ ] Add retention/deletion/export policy, backups and redacted observability.
- [ ] Add authenticated end-to-end browser tests.

## Known prototype limits

- [ ] No real payment or delivery.
- [ ] Operations page sees only the operator’s own account orders.
- [ ] $10 merchant shipping is an estimate, not a fetched quote.
- [ ] Allowed stores can still block, localize, require login or change HTML; manual entry must remain.
- [ ] RON conversion 0.23 USD/RON is static demo data.
- [ ] Customs content is informational, dated 9 September 2026 and not a duty calculator.
- [ ] Email-based account key is intentional due optional platform user ID; change only with migration.
- [ ] One JSON account state has 1 MB limit and is unsuitable for scale.
- [ ] Source titles are intentionally not translated automatically.
