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
- [x] Add batch link import, managed smart restrictions and an operator rule-management view.
- [x] Add Russian, Uzbek and English selection for shared navigation and communication preferences.

## Required before commercial launch

- [ ] Add compliant real payment, provider webhook, refunds and reconciliation. Demo balance is not money.
- [x] Replace static FX and tariff constants with versioned operator-managed data.
- [ ] Connect and verify an automatic FX/tariff feed before presenting values as live.
- [x] Build a server-authorized cross-customer operator queue.
- [ ] Replace the pre-release team assignment with independent staff identities, permissions and a relational immutable audit trail.
- [x] Add a preparatory staff directory and persistent audit events for operator changes; actual staff authorization still waits for standalone auth.
- [ ] Complete the cutover from compatible JSON customer state to relational canonical orders/ledger with transactional outbox and automated reconciliation.
- [x] Add non-destructive normalized customer/order/fee/event/consent tables, dual-write operational projection, administrator rebuild and integrity counters.
- [ ] Re-verify Uzbekistan customs rules, legal/privacy requirements and recipient-limit model.
- [x] Add in-app order status, refund and approval notifications.
- [ ] Integrate actual carrier routes/tracking and external email/SMS delivery. Push is intentionally out of scope.

## Importing

- [x] Add a public Shopify adapter and live-check Allbirds, Kylie Cosmetics, ColourPop and Steve Madden; extend ProductGroup matching for Fashion Nova.
- [ ] Verify Bombas, Gymshark and Anker Ajax coverage with current product URLs; generic HTML remains fallback. Expand dedicated adapters for other major stores using actual page samples.
- [ ] Add authorized eBay Browse API if reliable eBay sourcing is needed. No credential/adapter exists.
- [x] Add caching, source timestamp and expiry for imports.
- [ ] Improve option matrix: colour → valid size → price → stock; current UI uses a flat variant list.
- [x] Add up to 12 safe imported photos and variant photo/price switching to link order. Persisted orders retain the selected image.
- [ ] Add gallery support to batch confirmation and persist full galleries if required; implement separate color → size controls instead of the compatible flat variant selector.
- [ ] Test the allowlist against live pages regularly. Store HTML and bot behavior change.

## Order flow

- [x] Make manager merchant-shipping confirmation clearer in customer order UI; show actual USD and UZS.
- [x] Add customer approval for changed item price, unavailable item, substitutions and warehouse services with exact amount checking and a blocked pending state.
- [x] Add warehouse intake for condition, quantity, photos/repacking/consolidation/split/fragile operations and parcel grouping before weighing.
- [ ] Define combined-shipping logic for multiple units; source shipping currently multiplies per quantity.
- [ ] Define post-purchase cancellation/refund rules. Current automatic cancellation is status 0 only.
- [x] Add private manager invoice, purchase-proof, warehouse-photo and warehouse-report uploads with customer-owned download access.

## Auth/data/operations

- [ ] Choose and integrate standalone auth (email password or email code, recovery, optional Google OAuth, rate limits and consent records). Do not collect passwords until an identity provider or audited password implementation is selected.
- [ ] Connect a verified email sender for actual notification delivery; current email/SMS history is preview-only.
- [ ] Select a phone-verification provider and retention policy before requiring a phone at payment/delivery.
- [ ] Add encrypted off-platform D1/R2 backups with retention and a tested restore runbook; administrator integrity/rebuild is not an external backup.
- [x] Add administrator-only D1 export with checksum and audit record, excluding private blob bytes.
- [x] Add captured operational error summaries for administrator monitoring.
- [x] Add server-enforced customer review/blocking and an administrator customer/support/finance/system workspace.
- [ ] Translate every transactional screen and validation message for RU, UZ and EN; navigation localisation is not full localisation.
- [ ] Document/test production D1 migration from local machine before schema changes.
- [ ] Add retention/deletion/export policy, backups and redacted observability.
- [x] Draft the public intermediary/logistics offer, privacy policy, passport consent and payment/refund policy with transparent buyout, delivery, conversion and optional-service fees.
- [ ] Fill legal entity name, registration/INN, address, support contacts and bank details; obtain Uzbek counsel approval and reviewed UZ/EN legal translations.
- [ ] Select a compliant production OCR/identity provider, document consent/legal basis, retention windows and regional data processing before relying on passport recognition.
- [ ] Add scan-quality checks for blur, glare, cropped MRZ, expiry and check digits; current browser OCR is best effort and manual confirmation remains required.
- [ ] Add a real customs integration only after official API access, document mapping, signed audit trail and legal review. Current submission status is preview-only.
- [ ] Complete translation of every detailed legacy screen and notification template; the shared shell and language preference are available now.
- [x] Add a headless browser smoke test for core public interactions and navigation.
- [ ] Extend browser coverage through authenticated checkout and operator actions.

## Known prototype limits

- [x] Replace public demonstration products with five real merchant snapshots, official photos, dated source prices and direct source links; preserve legacy order snapshots.
- [x] Add administrator source rechecks through the protected importer and automatically hide expired deal snapshots.
- [ ] Turn successful catalog rechecks into a reviewed publishing workflow; current checks never silently overwrite the editorial price. Validate image reuse/merchant agreements before commercial distribution.
- [ ] Expand fresh verified merchants beyond Nike, Anker and Apple. UNIQLO listing prices were not fresh enough to include.
- [x] Import exact-listing ProductGroup variants and prices for Nike, without switching to an unrelated default color.

- [ ] Revisit client-side RSC navigation after Vinext fixes its production prefetch runtime; Atlas currently uses reliable full-page navigation.
- [ ] No real payment or delivery.
- [ ] Only one operator email is supported; team assignment exists, but independent staff identities and permissions are still missing.
- [ ] $10 merchant shipping is an estimate, not a fetched quote.
- [ ] Allowed stores can still block, localize, require login or change HTML; manual entry must remain.
- [ ] RON conversion 0.23 USD/RON is static demo data.
- [x] Simplify catalog discount badges and move itemized quotes/weight margins into detail views; add an independent RU/UZ/EN courier-customs estimator.
- [ ] Customs estimate is informational (checked 11 September 2026), not a binding charge. Confirm dutiable weight/value, effective-date interpretation, exclusions and bonded-vs-courier regime with the production carrier/legal adviser before commercial use. No official allowance lookup; user manually enters other imports.
- [ ] Email-based account key is intentional due optional platform user ID; change only with migration.
- [ ] One JSON account state has 1 MB limit and is unsuitable for scale.
- [ ] Source titles are intentionally not translated automatically.
- [x] Fix standalone TypeScript errors in account status rendering and admin/identity/batch response typing.
- [x] Add explicit guest/customer/admin rendering gates, stale-session clearing and a repeatable browser audit across protected routes and responsive sizes.
- [ ] Standalone email/password and Google OAuth remain postponed by product decision; current member sign-in uses the platform flow.
