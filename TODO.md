# Atlas TODO and known limitations

## UX refinement follow-up

- [x] Compact catalog cards, disclose secondary filters and pricing details, simplify guest introduction.
- [x] Expandable order rows, grouped notification history, direct links to order details and checkout review step.
- [x] Compact account sections, legal consent deep links and searchable/filterable catalog administration.
- [x] Turn the account landing screen into a state-aware customer dashboard with one next action, compact counters and primary service shortcuts.
- [x] Make account secondary panels mutually exclusive and remove paired-panel stretching and repeated decorative hierarchy.
- [ ] Add populated-order/operator and checkout-review browser fixtures beyond current domain and guest/customer route coverage.
- [ ] Finish RU/UZ/EN translations across legacy forms, legal and operator screens; customer order, balance, notifications and link-order messages now follow the selected locale, while legacy/admin/legal/server-history strings remain.
- [ ] Implement saved searches, recently viewed products and price/size alerts only with authenticated persistence and a real refresh/delivery mechanism.
- [ ] Validate the shortened experience with actual customers; visual simplification alone does not establish improved retention.
- [x] Add a production SEO baseline: canonical metadata, Open Graph/X fields, crawl boundaries and a public sitemap for catalog, customs and legal content.
- [x] Add an AI-discovery factsheet and explicit `OAI-SearchBot` crawl policy without exposing authenticated routes or personal data.
- [ ] Complete localization of all legacy validation, legal and operator copy; shared shell plus customer order, balance, notifications and link-order copy now use RU/UZ/EN keys.

- [ ] Add scheduled same-SKU regional price comparison. Current regional storefront support imports the exact customer URL but does not yet prove that Spain, Germany or the US is cheapest after local shipping and tax.
- [ ] Record live import fixtures for non-Shopify regional leaders such as Primor, Druni, PcComponentes, MediaMarkt, Zalando and major US department stores; allowlist coverage currently falls back to safe JSON-LD/Open Graph or manual confirmation when their anti-bot pages block Atlas.
- [ ] Replace deal-shelf weight estimates with importer-confirmed boxed weights when merchants expose them reliably; link order already rechecks before checkout.
- [ ] Replace deal-shelf fallback size lists with scheduled merchant-confirmed availability snapshots; current choices are revalidated only when the customer adds the selected item.

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

- [x] Reject impossible merchant weight values before display, use safer category estimates and add a customer availability confirmation/report queue for blocked catalog imports.
- [x] Reconcile source-controlled merchant additions into the existing D1 catalog without overwriting operator edits or hidden records; use the same published records in admin, collections, public catalog and ordering.
- [x] Add an operator bulk-link catalog workflow with editable drafts, safe collection-page discovery and explicit publish/hide actions.
- [x] Add D1-managed RU/UZ/EN home collections so clothing, cosmetics, brands and seasonal selections do not require a code deployment.
- [x] Add a bounded, merchant-fair catalog-refresh queue, safe auto-unpublish for a confirmed all-sold-out matrix, operator batch control and a protected scheduler endpoint. Source-controlled price, photo and option changes refresh the published snapshot only after a complete successful source response.
- [ ] Provision a separate Cloudflare scheduled Worker (or equivalent managed scheduler), configure `ATLAS_CATALOG_REFRESH_SECRET` in both runtimes, and verify the hourly trigger, HMAC call and alert handling in production. The current Sites/Vinext Worker has no cron trigger.
- [x] Add a public Shopify adapter and live-check Allbirds, Kylie Cosmetics, ColourPop and Steve Madden; extend ProductGroup matching for Fashion Nova.
- [x] Expand rich Shopify import to 20 explicit storefront roots across clothing, beauty, sneakers and electronics; live-check Alo Yoga, Rhode, Rare Beauty, Summer Fridays, Kith, CNCPTS, Satechi and Spigen.
- [ ] Verify Bombas with a current product URL. Gymshark active-color/size parsing and Anker embedded-product parsing have live checks; expand dedicated adapters for other major stores using actual page samples.
- [ ] Add authorized eBay Browse API if reliable eBay sourcing is needed. No credential/adapter exists.
- [x] Add caching, source timestamp and expiry for imports.
- [x] Add a color → valid size → combination price/photo/stock matrix to link order while keeping a flat fallback for nonstandard product options.
- [x] Add up to 12 safe imported photos and variant photo/price switching to link order. Persisted orders retain the selected image.
- [x] Add review-first per-item variant confirmation and variant prices to batch import; no first available combination is silently selected.
- [x] Recheck linked product price, currency and selected-variant availability on the server before cart addition and checkout.
- [x] Add an administrator recheck queue for fetch errors and price/currency/availability changes, with explicit review before republication.
- [ ] Test the allowlist against live pages regularly. Store HTML and bot behavior change.

## Order flow

- [x] Make manager merchant-shipping confirmation clearer in customer order UI; show actual USD and UZS.
- [x] Add customer approval for changed item price, unavailable item, substitutions and warehouse services with exact amount checking and a blocked pending state.
- [x] Add warehouse intake for condition, quantity, photos/repacking/consolidation/split/fragile operations and parcel grouping before weighing.
- [x] Combine international freight for cart lines from the same merchant and dispatch country, with one parcel allowance and a 1 kg minimum.
- [ ] Define merchant-to-warehouse shipping consolidation; the merchant shipping amount currently multiplies per quantity because store checkout rules are not known before purchase.
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
- [ ] Translate every remaining operator validation message, server history and legal/notification template for RU, UZ and EN. Customer order, balance, notification shell and link-import copy now localize; legacy operations/admin/legal body text remains.
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

- [ ] Replace the manually observed deal shelf with a licensed/approved direct-merchant or affiliate feed and scheduled expiry checks before commercial use.

- [x] Replace public demonstration products with five real merchant snapshots, official photos, dated source prices and direct source links; preserve legacy order snapshots.
- [x] Add administrator source rechecks through the protected importer and automatically hide expired deal snapshots.
- [x] Turn successful imports into a reviewed draft/publish workflow; draft edits never silently overwrite the published snapshot.
- [ ] Validate product-image reuse, affiliate/merchant agreements and source-attribution requirements before commercial distribution.
- [ ] Expand fresh verified merchants beyond Nike, Anker and Apple. UNIQLO listing prices were not fresh enough to include.
- [x] Import exact-listing ProductGroup variants and prices for Nike, without switching to an unrelated default color.

- [ ] Revisit client-side RSC navigation after Vinext fixes its production prefetch runtime; Atlas currently uses reliable full-page navigation.
- [ ] No real payment or delivery.
- [ ] Only one operator email is supported; team assignment exists, but independent staff identities and permissions are still missing.
- [ ] $10 merchant shipping is an estimate, not a fetched quote.
- [ ] Allowed stores can still block, localize, require login or change HTML; manual entry must remain.
- [ ] Catalog refresh endpoint is implemented but no production scheduler secret or cron caller is configured yet; manual due-batch refresh is available only to the operator.
- [ ] RON conversion 0.23 USD/RON is static demo data.
- [x] Simplify catalog discount badges and move itemized quotes/weight margins into detail views; add an independent RU/UZ/EN courier-customs estimator.
- [ ] Customs estimate is informational (checked 11 September 2026), not a binding charge. Confirm dutiable weight/value, effective-date interpretation, exclusions and bonded-vs-courier regime with the production carrier/legal adviser before commercial use. No official allowance lookup; user manually enters other imports.
- [ ] Email-based account key is intentional due optional platform user ID; change only with migration.
- [ ] One JSON account state has 1 MB limit and is unsuitable for scale.
- [ ] Source titles are intentionally not translated automatically.
- [x] Fix standalone TypeScript errors in account status rendering and admin/identity/batch response typing.
- [x] Add explicit guest/customer/admin rendering gates, stale-session clearing and a repeatable browser audit across protected routes and responsive sizes.
- [ ] Standalone email/password and Google OAuth remain postponed by product decision; current member sign-in uses the platform flow.
