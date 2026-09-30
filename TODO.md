# Atlas TODO and known limitations

## NYC merchant egress and automatic refresh — 30 September 2026

- [x] Provision the dedicated UpCloud VM with SSH-key-only access, host firewall and system updates; install Caddy and issue/renew HTTPS for the temporary `85-9-196-196.sslip.io` hostname.
- [x] Run the HMAC-authenticated, exact-host allowlisted merchant proxy as an unprivileged loopback-only systemd service; cap payloads, concurrency and timeouts, and keep Site customer/API/D1 traffic out of the VM.
- [x] Add an optional Site Worker transport with fail-closed partial configuration and automated HMAC, replay, allowlist and unsafe-header tests; preserve the original merchant parser and manual-entry fallback.
- [ ] Deploy `ATLAS_IMPORT_PROXY_URL` plus secret `ATLAS_IMPORT_PROXY_SECRET` to the Site, verify an authenticated production refresh run, then enable the hourly UpCloud timer.
- [ ] Replace the bootstrap `sslip.io` name with an Atlas-owned DNS hostname when the domain's DNS is available.
- [ ] Add an external operator alert for repeated refresh failures; currently safe status/reason codes are in the systemd journal only.
- [ ] Add a bounded retry/backoff policy only if production logs show transient failures; do not increase the batch or hammer rate-limited stores.

## Mobile follow-up — 30 September 2026

- [x] Add shared swipe/button/keyboard galleries in product details, link import and cart; retain optional safe photos in new carts and keep old carts compatible.
- [x] Improve narrow-screen fields, wrapping, modal bounds and touch targets across customer, admin and operations screens using safe browser fixtures without D1 writes.
- [ ] Test horizontal swipes, vertical scrolling, pinch zoom, on-screen keyboard, safe areas and delivery dialogs in physical iPhone Safari and Android browsers. Chromium responsive fixtures are not real-device verification.
- [ ] Check real authenticated production flows and live multi-photo merchant responses on a dedicated test account. Existing carts containing only one stored image cannot reveal photos that were never saved.

## Link-order lock recovery — 30 September 2026

- [x] Require explicit matching catalog context, not just URL equality, before locking Atlas fields; preserve manual entry and changing to another source.
- [x] Keep a valid dated catalog amount as a disclosed fallback estimate instead of clearing a read-only price; leave missing price/currency editable and derive finite legacy boxed weight.
- [x] Verify six merchant-shaped UI fixtures at 360/1440 px, blocked/fresh responses, catalog vs. pasted-link modes, changing links and intercepted cart submissions. Missing legacy country remains editable. No real account/cart or D1 state was changed.
- [ ] Verify actual authenticated merchant imports and checkout on a dedicated test account across the priority stores. Merchant blocking/incomplete responses remain supported manual fallback, not guaranteed automatic imports; do not bypass challenges or infer stock.

## Homepage and sizing QA — 30 September 2026

- [x] Improve homepage hero/catalog/cards/link-entry/steps/stores/trust/FAQ/footer with route-scoped responsive spacing and progressive catalog rendering; preserve all product features.
- [x] Use installed Node/npm and Playwright CLI for Chromium guest/member smoke checks with public catalog and synthetic account/import fixtures; no local D1 modification is required.
- [x] Distinguish Nike US women/men, show official UK/EU/CM-JP and foot-length cm, and cover legacy inference and non-Nike/non-USD exclusion with tests.
- [x] Add reserve settlement help and reduce confirmation spacing; align service disclosure and quote totals without changing saved fee lines.
- [ ] Test Safari/iOS and Android on physical devices, actual authenticated production checkout, and live API latency/Core Web Vitals; responsive Chromium fixtures do not prove those workflows or performance targets.
- [ ] Add independently sourced size guides for other brands/categories. Do not apply the Nike chart generically; missing official foot measurements remain unavailable rather than invented.

## Order-by-link follow-up — 30 September 2026

- [ ] Enter and confirm the actual store-to-Atlas USD shipping for existing published catalog products where known. Older saved records still use the compatible $10 provisional reserve until an operator updates them; no production catalog records were changed by this code update.
- [ ] Visually verify the expanded cost disclosure, help popover and country/currency/category controls at 360/390/768 px in light and graphite themes. The local UI flow was not run because its local D1 setup is missing `market_settings` and there is no safe populated UI fixture.

## Catalog filter redesign — 29 September 2026

- [x] Replace the stretched “More filters” row with a compact, responsive filter control and a clearly grouped country/delivered-budget panel.
- [x] Show a selected-count badge only for active panel filters and expose chosen values as individually removable chips; keep search, category, sort and delivered-total behavior unchanged.
- [ ] Verify the published panel at 360/390/800/1440 px in light and graphite themes; source checks/build do not replace an interactive visual pass.

## Delivery help popover — 29 September 2026

- [x] Reset the help popover's inherited no-wrap text behavior and scope the quote accordion's spacing to only its top-level summary.
- [ ] Verify the published tooltip visually at desktop and phone widths in light/dark themes; Playwright CLI is unavailable in this runtime because `npx` is not installed, so source checks are not visual verification.

## Nike galleries and grouped service display — 29 September 2026

- [x] Match Nike's exact linked article from string or object-shaped PDP data; retain all exact-group colors for catalog review while order-by-link shows only the linked article/color.
- [x] Preserve one safe image per Nike gallery slot; use the linked article's gallery in order-by-link and retain per-color galleries for catalog imports.
- [x] Group service, buyout, conversion, international freight and delivery margin under one service amount while retaining expandable component amounts and the original quote math.
- [x] Add live-shaped importer fixture coverage and a quote-display total regression test; keep D1 and saved order/cart schemas unchanged.
- [ ] Complete authenticated browser interaction/visual verification for color switching, gallery thumbnails and grouped costs at phone/desktop sizes; automated source/build checks do not verify the published D1/auth-backed experience.

## Refund workflow, SEO boundaries, and diagnostics — 29 September 2026

- [x] Add an operator-only issue/refund case for active and cancelled orders with reason, status, proposed amount and bounded history; keep it separate from internal notes and customer notifications, and never change payment or balance from a proposal.
- [x] Clarify one-colorway merchant labels in link ordering without presenting descriptive slash-separated text as multiple selectable colors; retain the exact source label on demand.
- [x] Add local-only Core Web Vitals/API-latency diagnostics and explicit canonical/noindex route metadata; no customer telemetry is uploaded.
- [ ] Complete an authenticated production smoke for refund cases, order messages, color/size selection and desktop/mobile dark/light layouts. Do not use real customer contact data or perform a real refund.
- [ ] Keep the separate catalog-refresh Cron Worker and its HMAC secret provisioning/alerting as an external launch gate; the built-in source alone does not mean the schedule is live.

## Nike variant selection and operator contacts — 29 September 2026

- [x] Restrict catalog Nike variants to the exact linked product group; preserve per-color prices, images and size IDs, keep direct-link ordering on its exact article, and label verified US men's sizing with Nike's official chart.
- [x] Add operator order refresh and search by buyer/account/recipient identifiers; show purchaser email/profile phone separately from delivery contacts with click-to-email/call links.
- [x] Move the customer store-shipping reserve note beside payment status and explicitly label it a preliminary reserve, not a payment.
- [x] Restore the localized `КАТАЛОГ ATLAS` feed eyebrow and clear ESLint's four pre-existing warnings plus the new implementation's warnings.
- [ ] Complete an authenticated local operator/customer UI smoke with isolated fixture API responses; the ordinary local API smoke currently fails because local D1 has no `market_settings` table. Keep that database unchanged; this gap does not prove a production database issue.
- [ ] Review the expanded operator contact card and size selection on phone and desktop in both themes using an authenticated test account; do not use real customer contact details for screenshots.

## Design and closed pilot — 23 September 2026

- [x] Prepare three isolated interactive design directions across four key screens, RU/UZ/EN and responsive layouts (`design/`).
- [x] Record source-level design audit, staged migration order and pilot evidence gates (`design/README.md`, `PILOT_READINESS.md`).
- [x] Owner selected A / Commerce on 24 September; first production visual pass applied to shared shell, catalog, checkout surfaces and account next action.
- [x] Apply the guest Commerce hero, responsive admin rows and form-based support replies / collection creation; repair the catalog audit's fixed-category assumption.
- [x] Check operator admin tabs at 1440/800/390/360px and fix the 390/360px authenticated header overflow.
- [x] Preserve high contrast in the account next-action panel when shared surface colors are overridden by the active palette.
- [x] Fix remaining dark-theme catalog accents whose legacy rules used navy text on low-contrast surfaces.
- [x] Consolidate global pricing, per-dispatch-country overrides, FX and warehouse-service rates into one operator-only `/admin` section; remove the duplicate editor from `/operations` and keep saved order snapshots immutable.
- [x] Verify the existing customer/admin boundary: customers have no admin navigation, direct admin routes show the denial state, and `/api/operations` rejects non-operators before returning data.
- [ ] Visually review the new catalog accent colors and centralized tariff tab in light/dark mode at desktop and iPhone widths; the local in-app browser harness could not attach to this preview during this pass.
- [ ] Finish Commerce migration by consolidating overlapping rules across existing stylesheets; audit populated customer/operator states and mobile content density.
- [ ] Complete legal/carrier/PSP/auth/operational pilot gates; never enable real payments based on visual readiness alone.

## UX refinement follow-up

- [x] Turn expected blocked-store/time-out responses in operator catalog import into safe incomplete drafts instead of generic HTTP 503 failures; do not carry unverified prices or stock into the draft.
- [x] Make catalog variants editable for operator review and require price/currency plus a named, explicitly confirmed available option before publication.
- [ ] Complete the 35-priority-store catalog expansion only with individually verified product URLs and merchant details. Many source profiles return bot challenges or incomplete data; do not fabricate products, photos, prices, or availability. eBay still requires manual review unless the supported listing data can be obtained through an approved source.

- [x] Let unsupported public HTTPS stores continue as explicit manual-entry orders without making a server request to that host; cart-add remains clickable and guides the customer to each missing field.
- [x] Expand the exact eBay storefront allowlist; let blocked/incomplete eBay pages produce manually reviewable admin drafts without publishing them or overwriting an existing complete draft.
- [x] Remove generated Atlas boilerplate from product descriptions, hide known legacy boilerplate in public catalog output and the operator editor, and preserve actual editorial descriptions.
- [ ] Validate representative live eBay item URLs from desktop/mobile shares; public merchant blocks can still prevent automatic title, price, photo and option extraction, so manual entry remains the supported fallback.

- [x] Route successful catalog, link and batch additions directly to the cart; offer simulated payment confirmation from cart checkout. Real provider payments remain blocked on PSP integration.
- [x] Remove the customer stock-status gate from link/batch cart addition and checkout while retaining live selected-option, price and currency verification; catalog auto-hide remains a separate operator feed policy.
- [x] Add operator-managed dispatch-country overrides for existing service, buyout, conversion, delivery margin, per-kg freight, reserve and optional-service tariff fields; old pricing state and submitted quote snapshots remain compatible.
- [x] Localize global and dispatch-country pricing controls, warehouse-service settings and supported country names in RU/UZ/EN.
- [ ] Validate country-label coverage as merchant regions are added; complete the remaining legacy operator copy localization pass.

- [x] Remove the low-value customer profile JSON download; keep operator-only database backup export separate.
- [x] Remove the legacy browser-data migration panel from the customer account; the server-side `import-legacy` path remains a separate pre-launch blocker.
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
- [ ] Re-run the public browser audit with at least one fresh, reviewed D1-published merchant snapshot in strict `ATLAS_AUDIT_REQUIRE_CATALOG=1` mode. A seven-day-old snapshot alone should retain its card while suppressing current price/availability confidence; empty output points to missing publication or another validation blocker. The public catalog API returned 24 products during the 27 September 2026 check. Do not refresh timestamps without a real source check.

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

- [x] Preserve link-order form state across RU/UZ/EN switches and route remounts with a bounded session draft; the server compares price/currency when public source data is returned.
- [x] Add verified customer link imports to the D1 catalog as idempotent operator-reviewable drafts, without auto-publishing or treating them as inventory.
- [x] Reject impossible merchant weight values before display, use safer category estimates and keep an operator availability report queue for blocked catalog imports.
- [x] Reconcile source-controlled merchant additions into the existing D1 catalog without overwriting operator edits or hidden records; use the same published records in admin, collections, public catalog and ordering.
- [x] Add an operator bulk-link catalog workflow with editable drafts, safe collection-page discovery and explicit publish/hide actions.
- [x] Add D1-managed RU/UZ/EN home collections so clothing, cosmetics, brands and seasonal selections do not require a code deployment.
- [x] Add a bounded, merchant-fair catalog-refresh queue, safe auto-unpublish for a confirmed all-sold-out matrix, operator batch control and a protected scheduler endpoint. Source-controlled price, photo and option changes refresh the published snapshot only after a complete successful source response.
- [x] Add a separate Cloudflare Cron Worker source, HTTPS guard and runbook for the signed hourly refresh call; it never contains the production secret.
- [x] Configure `ATLAS_CATALOG_REFRESH_SECRET` in the Site and UpCloud's root-only refresh environment, then verify the signed hourly refresh through the protected Site endpoint. UpCloud systemd is the active external scheduler; the Site Worker itself has no cron trigger.
- [ ] Add external alert delivery for repeated refresh failures; systemd currently records bounded failure status/reason in the journal.
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
- [x] Recheck linked product price and currency on the server before cart addition and checkout when the merchant returns data; availability is not a customer-order gate.
- [x] Remove the manual merchant-page stock step. If public data is blocked or omitted, allow a customer-confirmed order request with any returned price/currency still checked; reject price/currency mismatches and definite not-found responses.
- [x] Add an administrator recheck queue for fetch errors and price/currency/availability changes, with explicit review before republication.
- [ ] Test the allowlist against live pages regularly. Store HTML and bot behavior change.
- [x] Add an explicit priority-1/priority-2 merchant registry and a separate searchable `/stores` directory grouped by product category; do not imply that every page is supported.
- [x] Match structured product data to the exact linked listing, retain unique SKU/GTIN variant IDs and reject unsafe/unrelated recommendation nodes.
- [x] Preserve unknown merchant availability as a separate optional state; it does not block customer cart/checkout, while catalog publication/refresh keeps its separate conservative stock policy.
- [x] Add a bounded embedded-state fallback for priority-1/priority-2 pages that omit JSON-LD; match the exact source path/listing id and retain public price, photos, SKU, option matrix and explicit stock only.
- [ ] Add store-specific public/official adapters and fixtures for Macy's, eBay, Walmart, Target, Best Buy, Sephora, Foot Locker, Zalando, Primor, Druni, MediaMarkt and PcComponentes. eBay exact-listing embedded/JSON-LD parsing and manual fallback are covered; broad automatic support still needs live fixtures, and an official Browse API would require authorization and credentials.
- [x] Provision and verify the UpCloud systemd timer using `scripts/catalog-refresh.mjs` and `ATLAS_CATALOG_REFRESH_SECRET`; the active call is bounded and HMAC-signed.
- [ ] Configure external alert delivery for repeated merchant-refresh failures.

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
- [ ] Allowed stores can still block, localize, require login or change HTML; manually confirmed price/option entry remains the fallback when the page is unavailable.
- [ ] eBay and MediaMarkt may return 403; Walmart and Target may return CAPTCHA. These responses never imply stock. A confirmed order can be saved when only public data access failed; a merchant's definite not-found response still stops it.
- [x] Catalog refresh is scheduled by the separate UpCloud systemd timer and calls the protected Site endpoint; a Cloudflare Cron binding is not required for this deployment.
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
- [x] Provision `ATLAS_CATALOG_REFRESH_SECRET` in the Site and UpCloud refresh caller and verify its signed request; keep the Cloudflare Cron Worker source as an optional alternative, not a second active scheduler.
- [ ] Select a real authentication/role model before enabling independent staff accounts; keep `market_staff_directory` non-authoritative and `ATLAS_OPERATOR_EMAIL` the sole operator gate for now.
- [ ] Review the public privacy draft and storage notice with counsel before describing either as legally sufficient cookie/data consent.

## Visual micro-UX review — 27 September 2026

- [x] Add a compact mobile checkout bar that preserves the current customs-consent gate and existing simulated checkout behavior.
- [x] Add a localized accessible copy action for order IDs, only in expanded order details.
- [x] Add reduced-motion-aware transitions, loading shimmer, and subtle pending-action emphasis.
- [x] Add a reviewable shared green palette override without altering the established brand mark or business logic.
- [x] Add a shared localized light/dark toggle and persist a manual choice in device-local preference only.
- [x] Keep white/light as the default regardless of system appearance; tune dark mode to low-glare graphite with softer contrast and restrained accents.
- [x] Restore rounded, contained catalog cards; keep long names/prices inside narrow cards and theme search/filter controls in graphite mode.
- [x] Apply the owner's requested semantic accent split: Atlas actions/mark use forest green or low-glare sage; blue remains for navigation and merchant-source links.
- [ ] Owner to review the mobile checkout bar proportions.
- [ ] Perform a visual browser pass in light and graphite themes at 360px, 390px, 800px, and 1440px after owner review; no full test suite is being repeated for this visual-only iteration.
- [x] Add a scoped graphite normalization layer for fixed light surfaces and contrast regressions across search/catalog, link import, cart, account, orders, warehouse services and operator screens.
- [ ] Verify dark-theme screenshots and contrast interactively in guest/customer/operator states at 360px, 390px, 800px and 1440px; the in-app Browser connection was unavailable during the source pass.

## iPhone-first mobile pass — 27 September 2026

- [x] Add edge-to-edge viewport metadata, safe-area-aware fixed navigation/cart spacing, iOS-friendly form text/targets and a narrower mobile header without removing access to account, cart, notifications or operator tools.
- [x] Add mobile account/cart/order-by-link checks and header-overflow checks to the browser audit; 191 checks passed in Chromium emulation at phone, tablet and desktop widths.
- [ ] Verify visual-viewport/keyboard behavior, notch and home-indicator spacing, VoiceOver focus order and graphite theme on current physical iPhones/Safari; emulation cannot establish device-level behavior.

## Catalog bulk import and future domain — 27 September 2026

- [x] Make the operator's 10-link import queue visible and lossless: show per-link progress, retain failed/unprocessed URLs, recover stale revisions and retry safely without auto-publishing drafts.
- [x] Show imported gallery and complete color/size/price/photo matrix in catalog review; pass bounded, sanitized optional option metadata through the public catalog and link-order fallback without changing legacy product/cart/order requirements.
- [x] Add a fixed 15-store US-first priority set, exact Sephora US/Spain and Victoria's Secret US/Spain storefront handling, and generic named option axes for shade/color, size/format/volume and bra band/cup without relaxing URL or image checks.
- [ ] Run authorized live import fixtures across the full 15-store US-first set and both Sephora/Victoria's Secret Spain storefronts. Current synthetic contracts do not prove merchant network access; these pages may block server requests or omit variant data. Do not bypass challenges or fabricate missing options.
- [ ] Attach and verify `atlasmarket.uz` in Sites/DNS before switching canonical URLs. Then update structured data, `metadataBase`, robots, sitemap, `llms.txt` and catalog-refresh worker origin together and verify HTTPS/canonical redirects.

## Button and cart response optimization — 27 September 2026

- [x] Batch account migration/initialization writes before loading the customer snapshot without changing account IDs or legacy compatibility.
- [x] Keep the revision-checked canonical account write synchronous but run the rebuildable operator projection through Cloudflare `waitUntil`, rereading and rechecking the latest account revision to guard against concurrent mutations.
- [x] Run idempotent customer-link catalog-draft creation in the background after the cart write; it no longer blocks the cart response.
- [ ] Measure hosted action latency (especially p50/p95 for catalog clicks, cart quantity changes and linked-item add) under a representative D1 account. Live merchant latency remains unavoidable on linked products; do not remove price/currency/selected-option checks to improve it.

## Full project diagnosis and route-performance pass — 27 September 2026

- [x] Split non-catalog route views into demand-loaded chunks with a localized loading boundary.
- [x] Stop fetching catalog data on account, cart, orders and unrelated routes; coalesce simultaneous catalog requests.
- [x] Make reads of initialized accounts read-only; retain idempotent account initialization and legacy identity migration for first visits.
- [x] Fetch pricing and policy settings together in account, action and operator request paths without changing response contracts.
- [x] Run ESLint, all 127 domain/API contract tests and a production Site build; no failures.
- [ ] Capture compressed production network waterfalls and hosted API p50/p95 for guest storefront, customer account/cart and operator routes. Do not use a local preview as a substitute for Site deployment measurements.
- [ ] Profile operator page payload: it currently projects up to 200 account JSON documents and related operational data; paginate or narrow server projections only with a compatibility plan.
- [ ] Measure shared `store`, `market-ui`, framework chunks and the global CSS transfer on current mobile Safari/network before attempting further splitting; CSS is globally composed and route separation may introduce visual regressions.
- [ ] Complete live interactive checks on the deployed Site in guest/customer/operator sessions and physical iPhone Safari; unit tests/build do not verify remote D1, R2, Cron, payment or merchant connectivity.
- [ ] Configure and verify production security headers, authentication identity provider and scheduled catalog refresh as separate production infrastructure changes; the source build alone does not establish those runtime settings.

## Copy hierarchy, brand accents and mobile cascade — 27 September 2026

- [x] Remove the extra “Поддерживаемые магазины” eyebrow; leave a single section heading, one concise explanation and compact store chips.
- [x] Restore the authenticated operator-only admin icon on narrow screens and allow admin-table columns to flex instead of inheriting fixed 90/92px columns.
- [x] Use forest/sage for Atlas primary actions and logo accent while preserving blue for navigation and merchant-source links; normalize the corresponding graphite-mode actions.
- [ ] Complete deployed visual screenshots at 360px and 390px, 800px and 1440px, in light and dark modes with guest/customer/operator states; verify current iPhone Safari separately. In-app Browser initialization failed during this source pass, so do not mark visual verification complete from the build alone.

## Catalog calculations and manual-store cart recovery — 27 September 2026

- [x] Show a labelled preliminary delivered estimate from a valid last-recorded catalog price when the seven-day merchant snapshot is stale; suppress stale discounts, option prices and current-stock claims. This is not a live merchant quote.
- [x] Fix cart-add/checkout for explicitly confirmed manual items from public HTTPS stores outside the importer allowlist. Those paths validate URL shape without fetching an unsupported host; allowlisted stores still require live price/currency/option verification.
- [x] Clip catalog photos to the rounded visual frame, remove the excessive title-to-price gap, compact estimate rows and constrain the supported-store strip to a centered readable width.
- [ ] As of 27 September 2026 the live catalog API returned 24 published cards, all beyond the seven-day confirmation window. Preliminary estimates can be displayed from their stored source prices, but none should be represented as current. Verify the separate scheduled Worker deployment/secret and obtain fresh operator-reviewed imports before advertising current prices.
- [ ] Confirm the published `/order-by-link` → `/cart` manual fallback with an isolated test identity/cart, and visually inspect the live catalog in light/dark at phone and desktop widths; do not use a real purchase flow for verification.

## Catalog queue and importer reliability — 27 September 2026

- [x] Separate newly queued, published, previously added/hidden, and all catalog entries for operator review; add responsive five-column cards, explicit multi-select, bounded recheck, reversible hide and confirmed removal of eligible drafts.
- [x] Keep catalog queue metadata optional for legacy D1 JSON and protect published/bundled products from hard deletion; audit mutation IDs.
- [x] Retain manual-review drafts for recoverable importer failures without asserting price, currency, variant price or stock; preserve Shopify per-variant prices, support XHTML and do not follow unapproved redirects.
- [ ] Run full lint/build in the supported Sites toolchain and complete a visual admin pass at desktop/mobile widths and both themes; the local pnpm wrapper attempted an unattended install and was stopped, so no dependency directory was changed.
- [ ] Verify high-priority merchant adapters against authorized live pages or stable fixtures maintained per merchant. An allowlisted hostname is not proof that each product page can be parsed.
- [x] Label source-backed catalog card actions as “Add to cart” and route them into the protected fresh-import/variant confirmation flow; never add the dated card snapshot directly.
- [ ] Activate and verify the separate hourly catalog-refresh Worker. This still requires an authenticated Cloudflare deployment environment, matching `ATLAS_CATALOG_REFRESH_SECRET` bindings, and evidence from a scheduled signed run; the Wrangler source/config is not an active job.
- [ ] Confirm the customs-rate effective date with the Uzbekistan Customs Committee: the consolidated PP-4508 text effective 2026-09-01 shows 20% / $2 per kg, while UP-174 §8 states that rate starts 2027-01-01. Until resolved, the link-order figure is informational only and must not be sold as a confirmed customs quote.
- [ ] Run visual verification of the updated link-order summary (light/dark, phone/desktop) on the published Site after deployment; verify the quote total is unchanged and every existing quote component remains separately labelled.

## Admin/catalog and storefront feedback — 29 September 2026

- [x] Allow bulk catalog rechecks over all selected matches by sending sequential groups of ten and retaining unprocessed IDs on a failure; keep the API's existing limit and revision checks.
- [x] Separate customer-submitted links from operator imports, published products and older/hidden records; retain availability reports inside the relevant product card.
- [x] Increase operator import to 16 unique links per launch, preserve remaining/failed links, infer collection membership for known stores and add localized seasonal/outfit/store/deals presets. Imports still create unpublished review drafts.
- [x] Keep an order CTA on every published catalog card and route it through live price/variant verification before cart persistence.
- [x] Simplify catalog discovery controls, split finance quote/fee/payment workflow summaries, add actual admin audit filters and unsaved pricing-change feedback, and remove public duplicate/setup copy.
- [ ] Provision and verify catalog Cron Worker plus `ATLAS_CATALOG_REFRESH_SECRET` on both Site and Worker before claiming automatic price/stock refresh or cleanup. UI currently describes manual refresh and keeps drafts on auto-hide.
- [ ] Select and configure a machine-translation provider before promising automatic translation of arbitrary collection titles; current translated presets are static.
- [ ] Decide whether customer-facing product/suggestion actions should be copied into the admin journal, then extend the source event schema/API if desired. Current actor filters correctly cover only the latest 100 returned admin/system events.
- [ ] Visually verify admin, catalog, finance, pricing, audit, cart customs threshold, and public CTA flows in guest/customer/operator contexts, at phone and desktop widths and in light/graphite themes. Local lint/tests/build do not verify D1, live auth, remote Worker or production layout.
- [ ] Clarify the customs effective date with Uzbekistan Customs Committee; PP-4508 consolidated text and UP-174 §8 disagree. Until confirmed, estimates remain informational.

## Refund review and customer follow-up — 29 September 2026

- [x] Add an operator-only refund/cancellation queue covering cancelled orders and positive owner-ledger customer credits; display Atlas balance entries without suggesting a bank/card/wallet transfer.
- [x] Keep internal operator comments distinct from bounded, order-linked in-app notifications saved only to that order owner's account; preserve operator auth, same-origin writes, revision checks and audit events, with no email/SMS delivery.
- [ ] Visually verify the refund tab, order-owner targeting label, note history and notification form at phone/tablet/desktop widths and in light/graphite themes.
- [ ] Replace simulated refund statuses with provider-backed refunds, reconciliation and customer notices only after a payment provider and compliant process are selected and verified.
