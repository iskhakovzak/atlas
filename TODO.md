# Atlas TODO and known limitations

## Design and closed pilot — 23 September 2026

- [x] Prepare three isolated interactive design directions across four key screens, RU/UZ/EN and responsive layouts (`design/`).
- [x] Record source-level design audit, staged migration order and pilot evidence gates (`design/README.md`, `PILOT_READINESS.md`).
- [x] Owner selected A / Commerce on 24 September; first production visual pass applied to shared shell, catalog, checkout surfaces and account next action.
- [x] Apply the guest Commerce hero, responsive admin rows and form-based support replies / collection creation; repair the catalog audit's fixed-category assumption.
- [x] Check operator admin tabs at 1440/800/390/360px and fix the 390/360px authenticated header overflow.
- [ ] Finish Commerce migration by consolidating overlapping rules across existing stylesheets; audit populated customer/operator states and mobile content density.
- [ ] Complete legal/carrier/PSP/auth/operational pilot gates; never enable real payments based on visual readiness alone.

## UX refinement follow-up

- [x] Route successful catalog, link and batch additions directly to the cart; offer simulated payment confirmation from cart checkout. Real provider payments remain blocked on PSP integration.
- [x] Add operator-managed dispatch-country overrides for existing service, buyout, conversion, delivery margin, per-kg freight, reserve and optional-service tariff fields; old pricing state and submitted quote snapshots remain compatible.
- [ ] Localize dispatch-country pricing controls and validation errors in RU/UZ/EN; validate country-label coverage as merchant regions are added.

- [x] Remove the low-value customer profile JSON download; keep operator-only database backup export separate.
- [x] Support multiple saved recipient addresses with separately confirmed passport identities; select saved recipients in checkout and snapshot their address/identity to each order.
- [x] Build declaration previews from each order's actual selected recipient and prevent mixing recipients in one package. This is still an internal simulated preview, not customs submission.

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
- [ ] Complete localization of all legacy validation, legal and operator copy; shared shell, product sheet, provider fallbacks, customer order, balance, notifications and link-order copy now use RU/UZ/EN keys.
- [x] Prevent Russian server exceptions from leaking through API failures in UZ/EN with a validated display-language preference and concise localized status messages; detailed legacy UI/legal copy and historical operator/catalog text remain outstanding.
- [ ] Re-run the public browser audit with at least one fresh, reviewed D1-published merchant snapshot in strict `ATLAS_AUDIT_REQUIRE_CATALOG=1` mode. The normal audit covers safe-empty catalog states; the local D1 catalog state examined on 20 September contained observations dated 11 September and correctly produced an empty public catalog after seven days. Do not refresh timestamps without a real source check.

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
- [x] Add authenticated end-to-end API smoke coverage. (Customer profile export was removed in the 24 September UX pass.)
- [x] Add private passport upload, editable MRZ assistance, explicit confirmation, deletion and masked identity state.
- [x] Add local address suggestions and server-built test declaration packages without external transmission.
- [x] Add batch link import, managed smart restrictions and an operator rule-management view.
- [x] Add Russian, Uzbek and English selection for shared navigation and communication preferences.

## Required before commercial launch

- [ ] Add compliant real payment, provider webhook, refunds and reconciliation. Demo balance is not money.
- [ ] Configure and verify Sites/Cloudflare edge protections in production: CSP, frame protection, referrer policy, global `nosniff`, and trusted injection/stripping of `oai-authenticated-user-*` identity headers. Endpoint checks alone do not establish this boundary.
- [x] Replace static FX and tariff constants with versioned operator-managed data.
- [ ] Connect and verify an automatic FX/tariff feed before presenting values as live.
- [x] Build a server-authorized cross-customer operator queue.
- [ ] Replace the pre-release team assignment with independent staff identities, permissions and a relational immutable audit trail.
- [x] Add a preparatory staff directory and persistent audit events for operator changes; actual staff authorization still waits for standalone auth.
- [ ] Complete the cutover from compatible JSON customer state to relational canonical orders/ledger with transactional outbox and automated reconciliation.
- [x] Add non-destructive normalized customer/order/fee/event/consent tables, dual-write operational projection, administrator rebuild and integrity counters.
- [ ] Re-verify Uzbekistan customs rules, legal/privacy requirements and recipient-limit model.
- [ ] Obtain Globbing's written approval and corporate agreement/process for centrally handled personal-use orders where Atlas manages buyout and the customer does not create a Globbing account; resolve store buyer, consignee, declarant, payment/reconciliation and customs responsibility before real orders. See `GLOBBING_B2B_PLAYBOOK.md`.
- [x] Add in-app order status, refund and approval notifications.
- [ ] Integrate actual carrier routes/tracking and external email/SMS delivery. Push is intentionally out of scope.

## Importing

- [x] Preserve link-order form state across RU/UZ/EN switches and route remounts with a bounded session draft; cart addition still requires a fresh server source check.
- [x] Add verified customer link imports to the D1 catalog as idempotent operator-reviewable drafts, without auto-publishing or treating them as inventory.
- [x] Reject impossible merchant weight values before display, use safer category estimates and keep an operator availability report queue for blocked catalog imports.
- [x] Reconcile source-controlled merchant additions into the existing D1 catalog without overwriting operator edits or hidden records; use the same published records in admin, collections, public catalog and ordering.
- [x] Add an operator bulk-link catalog workflow with editable drafts, safe collection-page discovery and explicit publish/hide actions.
- [x] Add D1-managed RU/UZ/EN home collections so clothing, cosmetics, brands and seasonal selections do not require a code deployment.
- [x] Add a bounded, merchant-fair catalog-refresh queue, safe auto-unpublish for a confirmed all-sold-out matrix, operator batch control and a protected scheduler endpoint. Source-controlled price, photo and option changes refresh the published snapshot only after a complete successful source response.
- [x] Add a separate Cloudflare Cron Worker source, HTTPS guard and runbook for the signed hourly refresh call; it never contains the production secret.
- [ ] Provision a separate Cloudflare scheduled Worker (or equivalent managed scheduler), configure `ATLAS_CATALOG_REFRESH_SECRET` in both runtimes, and verify the hourly trigger, HMAC call and alert handling in production. The current Sites/Vinext Worker has no cron trigger.
- [x] Add a public Shopify adapter and live-check Allbirds, Kylie Cosmetics, ColourPop and Steve Madden; extend ProductGroup matching for Fashion Nova.
- [x] Expand rich Shopify import to 20 explicit storefront roots across clothing, beauty, sneakers and electronics; live-check Alo Yoga, Rhode, Rare Beauty, Summer Fridays, Kith, CNCPTS, Satechi and Spigen.
- [ ] Verify Bombas with a current product URL. Gymshark active-color/size parsing and Anker embedded-product parsing have live checks; expand dedicated adapters for other major stores using actual page samples.
- [ ] Add authorized eBay Browse API if reliable eBay sourcing is needed. No credential/adapter exists.
- [x] Add caching, source timestamp and expiry for imports.
- [x] Pin Amazon.com anonymous checks to US storefront/USD and ZIP 19701 before parsing price, availability and images; reject the check when Amazon cannot confirm the location.
- [x] Add Adidas article-code JSON/PLP fallback for Akamai-blocked HTML, retaining sale price, safe gallery and current available sizes; use PLP-first parsing, Adidas-safe minimal headers, clothing/jersey category inference and the fixed apex edge retry when product JSON is rate-limited.
- [ ] Add equivalent verified postal-location profiles for other US merchants only where their public endpoint is documented and safe; do not assume one cookie or ZIP works across stores.
- [x] Add a color → valid size → combination price/photo/stock matrix to link order while keeping a flat fallback for nonstandard product options.
- [x] Add up to 12 safe imported photos and variant photo/price switching to link order. Persisted orders retain the selected image.
- [x] Add review-first per-item variant confirmation and variant prices to batch import; no first available combination is silently selected.
- [x] Recheck linked product price, currency and selected-variant availability on the server before cart addition and checkout.
- [x] Remove manual merchant-page availability confirmation from link ordering; automatically retry the source check and keep add-to-cart disabled until the protected server verification succeeds.
- [x] Add an administrator recheck queue for fetch errors and price/currency/availability changes, with explicit review before republication.
- [ ] Test the allowlist against live pages regularly. Store HTML and bot behavior change.
- [x] Add an explicit priority-1/priority-2 merchant registry and surface the first US/European stores in the link-order directory without claiming that every page is supported.
- [x] Match structured product data to the exact linked listing, retain unique SKU/GTIN variant IDs and reject unsafe/unrelated recommendation nodes.
- [x] Preserve unknown merchant availability as a separate optional state; block cart verification and catalog republishing until a stock signal is explicit.
- [x] Add a bounded embedded-state fallback for priority-1/priority-2 pages that omit JSON-LD; match the exact source path/listing id and retain public price, photos, SKU, option matrix and explicit stock only.
- [ ] Add store-specific public/official adapters and fixtures for Macy's, eBay, Walmart, Target, Best Buy, Sephora, Foot Locker, Zalando, Primor, Druni, MediaMarkt and PcComponentes. Generic JSON-LD remains the safe fallback when a merchant blocks or omits data.
- [ ] Provision the external scheduler using `scripts/catalog-refresh.mjs`, configure `ATLAS_CATALOG_REFRESH_SECRET` and alert on repeated merchant failures.

## Order flow

- [x] Make manager merchant-shipping confirmation clearer in customer order UI; show actual USD and UZS.
- [x] Add customer approval for changed item price, unavailable item, substitutions and warehouse services with exact amount checking and a blocked pending state.
- [x] Add warehouse intake for condition, quantity, photos/repacking/consolidation/split/fragile operations and parcel grouping before weighing.
- [x] Combine international freight for cart lines from the same merchant and dispatch country, with one parcel allowance and a 1 kg minimum.
- [ ] Define merchant-to-warehouse shipping consolidation; the merchant shipping amount currently multiplies per quantity because store checkout rules are not known before purchase.
- [ ] Define post-purchase cancellation/refund rules. Current automatic cancellation is status 0 only.
- [x] Add private manager invoice, purchase-proof, warehouse-photo and warehouse-report uploads with customer-owned download access.

### Warehouse service catalogue — 25 September 2026

- [x] Add an operator-managed RU/UZ/EN catalogue for common forwarding extras, with checkout/warehouse stage, unit, fixed/operator-quoted pricing, base price and per-dispatch-country overrides.
- [x] Let customers note services in the cart or request warehouse-stage options after recorded intake; snapshot terms so later admin edits do not rewrite orders.
- [x] Require operator feasibility/price review (or an explicit unavailable reason) and exact customer approval before a requested service can be marked complete; unresolved services block weighing.
- [x] Keep the existing quote immutable, preserve old cart/order compatibility without a migration, and prevent the built-in insurance offer from being enabled until coverage terms and claims handling exist.
- [x] Show fixed service rates per unit and country in the cart without adding them to the initial payable total; capture optional photo/day/half-hour counts in the cart signature and keep legacy per-item fees visually distinct.
- [x] Require a written customer note for a special warehouse request and display it to the operator; distinguish internal intake tags from completed/paid service work.
- [x] Keep damaged/mismatched intake on hold until the customer approves a proposed substitution explicitly marked by the operator as resolving that issue.
- [x] Remove dated freshness/store badges from catalog photos while retaining dispatch-country information, the direct merchant link and automatic availability controls.
- [ ] Confirm each configured service with the contracted warehouse, then enter reviewed Atlas prices, availability, limits, timing, cancellation/refund and package-impact rules before any commercial pilot.
- [ ] Integrate and audit real warehouse execution, evidence/photos, service exceptions and any additional payment flow; current completion flags and amounts are pre-release simulation only.
- [ ] Add a verified insurance partner and approved coverage/exclusions/claims process before making shipment insurance available.

## Auth/data/operations

- [ ] Choose and integrate standalone auth (email password or email code, recovery, optional Google OAuth, rate limits and consent records). Do not collect passwords until an identity provider or audited password implementation is selected.
- [ ] Remove or redesign the compatible `import-legacy` path before introducing real payment, shipment, entitlement or stored-value capability. It accepts local prototype state and must never become a path to a real monetary balance.
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
- [ ] Warehouse optional-service requests, quotes and completion status are currently workflow simulation. Do not treat configurable preview fees as live service prices or promise physical service until a warehouse contract and execution process are verified.
- [ ] Only one operator email is supported; team assignment exists, but independent staff identities and permissions are still missing.
- [ ] $10 merchant shipping is an estimate, not a fetched quote.
- [ ] Allowed stores can still block, localize, require login or change HTML; manual entry must remain.
- [ ] eBay and MediaMarkt may return 403; Walmart and Target may return CAPTCHA. Do not infer availability from those responses.
- [ ] Catalog refresh endpoint is implemented but no production scheduler secret or cron caller is configured yet; manual due-batch refresh is available only to the operator.
- [ ] Replace the dated Slickdeals-informed editorial batch with a licensed merchant/affiliate feed and confirm image reuse/attribution terms before commercial launch; keep canonical merchant URLs and recheck semantics.
- [ ] RON conversion 0.23 USD/RON is static demo data.
- [x] Simplify catalog discount badges and move itemized quotes/weight margins into detail views; add an independent RU/UZ/EN courier-customs estimator.
- [ ] Customs estimate is informational (checked 11 September 2026), not a binding charge. Confirm dutiable weight/value, effective-date interpretation, exclusions and bonded-vs-courier regime with the production carrier/legal adviser before commercial use. No official allowance lookup; user manually enters other imports.
- [ ] Email-based account key is intentional due optional platform user ID; change only with migration.
- [ ] One JSON account state has 1 MB limit and is unsuitable for scale.
- [ ] Source titles are intentionally not translated automatically.
- [x] Fix standalone TypeScript errors in account status rendering and admin/identity/batch response typing.
- [x] Add explicit guest/customer/admin rendering gates, stale-session clearing and a repeatable browser audit across protected routes and responsive sizes.
- [ ] Standalone email/password and Google OAuth remain postponed by product decision; current member sign-in uses the platform flow.

## GitLab Ultimate — 26 September 2026

- [x] Prepare a GitLab CI pipeline for lint, domain/security tests, production build, Dependency Scanning v2, Advanced SAST and secret detection without production credentials or deployment access.
- [ ] Connect the GitLab (Beta) app and identify the Atlas GitLab project; the connector was present but returned `not connected` during setup.
- [ ] Configure and validate a one-way GitHub-to-GitLab pull mirror; keep GitHub as the source of truth and avoid direct writes/bidirectional mirroring.
- [ ] Validate `.gitlab-ci.yml` in GitLab, run the first pipeline and confirm all enabled scan jobs and the Ultimate security dashboard.
- [ ] Run one historic secret scan after connection, review any findings, and keep routine pipeline scans incremental rather than rescanning all history each time.

## Jules PR source updates — 26 September 2026

- [x] Precompute the explicit importer supported-host allowlist while preserving the same accepted roots/subdomains.
- [x] Add accessible tooltips to icon-only Deals Feed controls using the existing tooltip dependency.
- [x] Integrate GitHub PR #2's already-merged mainline changes and the reviewed source changes from still-open PR #1 into the local working branch; do not push the local merge automatically.
- [ ] Verify the Macy's parser against a live supported product page; current automated coverage uses a synthetic public-state fixture and treats unknown availability conservatively.

## GitHub branch reconciliation — 26 September 2026

- [x] Review all GitHub branch heads against the current Site checkout; retain the verified mainline and selectively adapt safe importer and UX work instead of merging conflicting generated or security-sensitive patches wholesale.
- [x] Parse an exact Sephora `linkJSON` listing through the existing safe importer; reject unrelated products and keep missing stock unverified.
- [x] Add localized browser-storage notice, two-step cart/recipient removal, accessible support labels, address cards and localized empty-cart action without changing saved-state schemas.
- [ ] Provision `ATLAS_CATALOG_REFRESH_SECRET` in both Site and separate Cron Worker, deploy the Worker from `workers/catalog-refresh/wrangler.toml`, and verify scheduled signed calls plus safe failure/retry. The config file alone is not a live scheduler.
- [ ] Select a real authentication/role model before enabling independent staff accounts; keep `market_staff_directory` non-authoritative and `ATLAS_OPERATOR_EMAIL` the sole operator gate for now.
- [ ] Review the public privacy draft and storage notice with counsel before describing either as legally sufficient cookie/data consent.
