# Atlas TODO and known limitations

## Pre-release showcase completed

- [x] Collect and persist recipient, phone and delivery address during checkout.
- [x] Add an explicitly simulated payment-link lifecycle with confirmation and refund state.
- [x] Add operator team/priority assignment and internal order notes.
- [x] Add parcel, carrier, tracking number and tracking-event history entered by the operator.
- [x] Add email/SMS preferences and persistent message previews without external transmission.
- [x] Add operator analytics, pilot-readiness dashboard and pre-release legal drafts.
- [x] Add customer profile export and authenticated end-to-end API smoke coverage.
- [x] Add private passport upload, editable MRZ assistance, explicit confirmation, deletion and masked identity state.
- [x] Add local address suggestions and server-built test declaration packages without external transmission.

## Required before commercial launch

- [ ] Add compliant real payment, provider webhook, refunds and reconciliation. Demo balance is not money.
- [x] Replace static FX and tariff constants with versioned operator-managed data.
- [ ] Connect and verify an automatic FX/tariff feed before presenting values as live.
- [x] Build a server-authorized cross-customer operator queue.
- [ ] Replace the pre-release team assignment with independent staff identities, permissions and a relational immutable audit trail.
- [ ] Move from per-account JSON state to proper relational orders/ledger with migration, outbox and reconciliation.
- [ ] Re-verify Uzbekistan customs rules, legal/privacy requirements and recipient-limit model.
- [x] Add in-app order status, refund and approval notifications.
- [ ] Integrate actual carrier routes/tracking and external email/SMS delivery. Push is intentionally out of scope.

## Importing

- [ ] Add store-specific adapters from real test URLs. Zara is current detailed adapter; generic JSON-LD/OG is best effort.
- [ ] Add authorized eBay Browse API if reliable eBay sourcing is needed. No credential/adapter exists.
- [x] Add caching, source timestamp and expiry for imports.
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
- [ ] Select a compliant production OCR/identity provider, document consent/legal basis, retention windows and regional data processing before relying on passport recognition.
- [ ] Add scan-quality checks for blur, glare, cropped MRZ, expiry and check digits; current browser OCR is best effort and manual confirmation remains required.
- [ ] Add a real customs integration only after official API access, document mapping, signed audit trail and legal review. Current submission status is preview-only.
- [x] Add a headless browser smoke test for core public interactions and navigation.
- [ ] Extend browser coverage through authenticated checkout and operator actions.

## Known prototype limits

- [ ] Revisit client-side RSC navigation after Vinext fixes its production prefetch runtime; Atlas currently uses reliable full-page navigation.
- [ ] No real payment or delivery.
- [ ] Only one operator email is supported; team assignment exists, but independent staff identities and permissions are still missing.
- [ ] $10 merchant shipping is an estimate, not a fetched quote.
- [ ] Allowed stores can still block, localize, require login or change HTML; manual entry must remain.
- [ ] RON conversion 0.23 USD/RON is static demo data.
- [ ] Customs content is informational, dated 9 September 2026 and not a duty calculator.
- [ ] Email-based account key is intentional due optional platform user ID; change only with migration.
- [ ] One JSON account state has 1 MB limit and is unsuitable for scale.
- [ ] Source titles are intentionally not translated automatically.
