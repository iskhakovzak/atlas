# Atlas — project context

## Product

Atlas is a functional pre-release cross-border shopping prototype for customers in Uzbekistan. The intended commercial model is purchasing intermediary plus logistics agent, not the foreign seller or manufacturer. A user chooses a sourced merchant catalog item or pastes a foreign-store product link, receives an editable preliminary UZS calculation, saves a recipient/address, creates a simulated payment and follows the purchase, warehouse, parcel and delivery process.

It is not yet a commercial marketplace: no real payment, purchase, carrier booking, customs filing, money transfer or delivery takes place.

Published URL: https://atlas-uz-market.ishakovzakir0.chatgpt.site  
Handoff baseline: version 21 plus the current operational-database/admin release (publish result recorded after deployment).
Validation baseline: lint, 37 tests, TypeScript, production build, authenticated API smoke with staff/audit coverage and the 126-check desktop/tablet/mobile browser audit all pass.

## Customer flow

1. Open catalog or Заказ по ссылке.
2. Paste a public supported-store product URL.
3. The server imports available title, photo, brand, price, currency, source country, category, declaration draft, variants and weight.
4. Customer checks/edits the source data, selects size/colour/model and adds to cart.
5. For a party, customer can paste up to ten product links at once. Each imported position remains subject to the same verification before checkout.
6. If store shipping is unavailable, the form starts with editable $10 reserve.
7. Customer accepts customs conditions, enters the recipient/address and completes pre-release checkout. One cart line becomes one order.
7. Customer can upload a passport scan to private object storage, check/edit browser-detected MRZ fields and explicitly confirm identity data.
8. Confirmed identity, saved address and selected order lines form a test declaration package. It stays inside Atlas and is not transmitted to customs.
9. Customer confirms a safe simulated payment-provider result; no charge occurs.
10. Operator assigns a team and priority, adds internal notes, confirms merchant shipping, purchase, parcel/tracking, warehouse receipt, settlement and dispatch status.
11. Refunds appear as demo balance credit; extras require approval before the order proceeds.

## Current routes

| Route | Function |
| --- | --- |
| / | Sourced merchant finds, favourites, filters and quick link entry |
| /order-by-link | Import product and create quote |
| /cart | Cart, balance use, customs consent, simulated checkout |
| /orders | Customer orders, photo refresh and extra approvals |
| /operations | Cross-customer operator queue and managed pricing |
| /notifications | In-app status, refund and approval notifications |
| /analytics | Operator metrics and closed-pilot readiness |
| /legal | Pre-release terms, privacy, refunds and restricted-goods drafts |
| /account | Profile, delivery recipients, document centre, monthly purchase indicator, support requests and data export |
| /balance | Demo ledger/balance |
| /favorites | Saved catalog items |
| /customs | Customs guidance and consent |
| /identity | Private passport upload, MRZ assistance and customer confirmation |
| /declaration | Test declaration package from confirmed identity, address and orders |
| /batch-import | Import up to ten product links into one cart party |
| /admin | Operator-only managed limits, blocked categories and restricted-word rules |

## Roles and authentication

The public catalog, customs guide and legal terms are available to guests. Saved finds, import, cart, orders, balance, messages, account, passport and declarations require platform-owned ChatGPT sign-in. Atlas account identity is email:<lowercase email>. This was intentional: some hosted requests provide authenticated email but omit platform user ID. app/chatgpt-auth.ts treats platform ID as optional; lib/market/server.ts migrates an old platform-ID row into the email-based account. Do not reverse this without a migration.

An operator is an authenticated customer whose email matches secret ATLAS_OPERATOR_EMAIL. Client UI is not authorization: operator checks occur in server actions. There is no standalone email/password/phone registration; the user asked to postpone it. The public site access policy does not grant operator rights.

## Business logic and price calculation

Default pricing lives in lib/market/domain.ts and lib/market/world.ts. The operator can replace it with a centrally managed version; new and renewed quotes use the current version while submitted orders keep their original values:

| Item | Current demo rule |
| --- | --- |
| UZS per USD | 12,800 |
| Service fee | 12% of merchandise |
| International freight | 90,000 UZS / chargeable kg |
| International reserve | 20% of international freight |
| Dimensional divisor | 5,000 |
| Shipping mass | boxed kg + 0.3 kg + 0.2 kg |

Quote is merchandise + merchant-to-warehouse shipping + service fee + international freight + international reserve. Source shipping is per unit and quantity currently multiplies it conservatively.

Supported source currencies: USD, EUR, GBP, RON, CNY, TRY, JPY, KRW, AED, CAD and AUD. Their USD rates, USD/UZS, freight, service, reserve and dimensional divisor are operator-managed. Values remain demo/managed data until a verified market feed is connected.

## Shipping, balance and recalculation

Unknown store shipping uses editable $10 and sourceShippingEstimated true. Before a reserve-based order leaves status Ожидает выкупа, an operator enters actual total merchant shipping in USD:

- actual lower than reserve: customer-credit ledger entry immediately;
- equal: no adjustment;
- higher: customer must approve an extra.

Warehouse settlement compares actual and dimensional mass with quoted international freight plus reserve. Lower actual freight credits balance; an extra blocks delivery until approved.

Balance is a demo accounting view derived from entries in account state. It cannot receive real deposits or withdrawals. Orders retain immutable original quotes. Automatic cancellation is available only before purchase and returns full simulated amount to demo balance.

Order statuses: Ожидает выкупа → Выкуплен → На зарубежном складе → Готов к отправке → В пути → Доставлен.

## Import expansion — 12 September 2026

- The explicit allowlist now has 135 roots, adding Allbirds, Kylie Cosmetics, ColourPop, Steve Madden, Fashion Nova and Bombas. This is URL coverage, not a guarantee that every page can be imported.
- Selected Shopify merchants use public locale-aware product Ajax data and the matching cart currency endpoint (read-only, without customer cookies). The adapter retains per-variant price, availability, size/color, selected variant ID and up to 12 safe gallery photos. If public Ajax is unavailable, the original HTML extractor remains the fallback.
- Generic ProductGroup matching now tolerates tracking and size-variant query parameters while retaining color and other product-defining parameters. Fashion Nova's redirected color listing now returns the correct color's sizes and price. Generic color/size is one combined variant; formatted decimal/thousands prices are parsed.
- The link-order screen includes a searchable store directory, gallery switching and variant-specific price/photo updates. Unsupported or unconfirmed currencies never silently apply their source amount as USD.
- Live local checks: Allbirds Wool Runner (7 size records, sold out at check), Kylie Matte Lip Kit (38 shades), ColourPop Bare Necessities (sold out at check), Steve Madden Possession Black (17 size records), Fashion Nova Met My Match jeans (9 sizes for the linked color). Observed availability/prices can change. Bombas has allowlist/adapter coverage but no successful live product check recorded in this release.
- Validation: 43 automated tests, TypeScript, lint and production build passed; 136 browser checks include a real Steve Madden import, loaded gallery images, size selection and 390 px rendering. The new narrow-screen check exposed and fixed the imported form's minimum-width overflow.

## Importing stores and product data

POST /api/import is signed-in, same-origin and rate-limited to 12 imports per user/minute. Successful results are cached in D1 for 10 minutes and carry a source timestamp/expiry. lib/importer/stores.ts contains a static explicit allowlist of more than 100 store/brand domains. Importer validates HTTPS, port, credentials and every redirect to prevent SSRF. It uses public browser-like requests, no customer cookies, a 15-second timeout and 3 MB decoded HTML cap.

Generic parsing reads Schema.org JSON-LD plus Open Graph/Twitter fallback. It can return title, photo, price, currency, shipping, weights, category and declaration draft. Product form stays editable because stores can block Cloudflare, require login/region, generate price in JavaScript or change markup.

Images must pass safeImage: public HTTPS only with no credentials/ports/local hosts. Raw store markup is never injected into React.

### Zara

Zara has a dedicated parser. Its useful product information often sits in embedded window.zara.appConfig and window.zara.viewPayload JSON instead of JSON-LD. The adapter extracts selected colour from query v1, title, Zara brand, configured decimal price, store country, image, colour/size variants and per-variant image/price when supplied. UI hides unavailable variants and updates price/image when a selected variant provides data.

Verified URL at handoff:

https://www.zara.com/ro/en/relaxed-fit-quilted-leather-jacket-p04416276.html?v1=549815761&v2=2732942

At verification it returned Zara, jacket title, 1,059 RON, Romania, image and Ochre S/M/L/XL. This is not a permanent inventory/price claim.

## Customs

The customs page explains $200 monthly courier and separate $100 postal norms, stores consent on checkout, and does not calculate duty. It cannot see the recipient’s external purchases. Re-verify legal text before commercial use.

## What works

- Navigation, catalog, account, favourites, cart, orders, balance, customs and operator test UI.
- Account-backed D1 state with revision conflicts prevented.
- Server-validated cart/order/action flow.
- Generic allowlisted product import with manual fallback.
- Zara price/photo/colour/size parser and RON source currency.
- Import photo in cart/order and photo refresh from retained source URL.
- Merchant-shipping reserve confirmation/refund/extra flow.
- Customer order view shows the pending merchant-shipping check and confirmed actual cost in USD and UZS.
- Site navigation uses native document transitions to avoid the Vinext production prefetch failure that made links unresponsive.
- Cross-customer operator queue with server-side operator authorization and revision conflicts.
- Centrally managed versioned FX/tariff settings for future quotes.
- In-app customer notifications for status changes, refunds and required approvals.
- Ten-minute import cache with visible source freshness.
- Headless browser smoke test clicks catalog filters, product details and primary navigation.
- Warehouse actual/dimensional settlement and balance credits.
- Recipient/address checkout and saved primary delivery profile.
- Local Uzbekistan region, city and street suggestions without sending typed addresses to a third-party geocoder.
- Private owner-scoped passport files in R2 with D1 metadata, consent, format/size/signature checks and deletion.
- Browser-assisted MRZ recognition when supported, with mandatory editable customer confirmation and a masked passport number in account state.
- Server-built declaration previews from confirmed identity, saved address and immutable order snapshots; no customs transmission.
- Batch import of up to ten supported store links into one cart, with per-item safe import and server-side pricing checks.
- Operator-managed smart restrictions: cart position count, estimated weight, merchandise-value ceiling, blocked categories and keywords requiring manual review.
- Russian, Uzbek and English language selection for navigation, account preference and notification setting; page content remains progressively localized.
- Simulated payment-link state with customer confirmation and refund status.
- Parcel, carrier, tracking number and tracking-event history.
- Operator team/priority assignment and internal notes.
- Email/SMS preferences plus a persistent pre-release delivery-preview log; no messages leave Atlas.
- Operator analytics and closed-pilot readiness dashboard.
- Pre-release legal/privacy/refund/restricted-goods drafts and customer data export.
- Authenticated API smoke test covers checkout through delivered status.

## Pre-release service experience

- Atlas has a shared blue/navy/lime design system, a link-first home screen with an interactive catalog example, responsive four-step journey, and consistent account/forms/order styling. Existing images, navigation and server actions are retained.
- The home and favourites use one deals-first feed with search, category/country filters, a delivered-cost budget, percentage/total sorting, saved items, and expandable quote breakdowns. Link entry remains below the feed. The new feed controls and descriptions support RU/UZ/EN; legacy sections and the product sheet retain their existing translations.
- The public feed now uses five sourced US listings in lib/market/catalog.ts: Nike Gato LV8, Cortez Leather, Club Hoodie, Anker Nano 30W and Apple AirTag 1-pack. Official product photos were checked for successful image responses. Prices are dated snapshots, not a live inventory feed. Only Gato and Cortez have reference prices taken from the merchant page. Other items have no fabricated discount. UNIQLO candidates were excluded because fresh pricing could not be confirmed.
- Old demonstration products remain in domain.ts for legacy state/test compatibility but are no longer offered by the feed. Old orders and stored favourite IDs are not rewritten.
- A catalog item opens a seeded link-order calculation with an unconfirmed variant, estimated weight and $10 merchant-shipping reserve. Customer verification is still required. Catalog snapshots cannot be directly added to cart while shippingKnown is false. The product sheet routes catalog items to this confirmation flow.
- ProductGroup JSON-LD import now selects children matching the exact source listing URL, including Nike color-specific sizes, prices and known unavailability; it does not assume all displayed sizes are in stock.
- Repeated demo/presentation wording was removed from the home, header, footer, sign-in introduction and metadata. Real payment/shipment limitations remain explicit at checkout and in legal/financial views. The underlying external services were not activated.

- The home screen explains the path from a store link to a preliminary calculation, confirmation and status tracking. It also includes a supported-store preview, FAQ and clear pre-release/trust notices.
- A profile can store several recipient addresses. The chosen primary recipient remains compatible with checkout and declarations. Customer support requests are retained in that customer's account state; staff response workflow still needs an operational queue.
- Checkout now lets the customer choose a saved recipient or switch to a fresh address, and support requests show their complete message history with customer replies.
- The document centre links to passport confirmation and declaration previews, explains the availability of future invoices/warehouse photos, and exports profile data. Passport source files remain private and are not placed in the JSON profile export.
- The monthly total is an informational sum of Atlas test orders, not a customs calculation or an official limit balance.

## Partial or missing

- Store parser quality varies; detailed Zara and selected Shopify adapters complement generic ProductGroup/JSON-LD extraction.
- Store shipping is frequently destination/session-dependent; $10 is reserve only.
- Operations supports one configured operator email. Team assignment and notes work, but independent staff identities and permission roles are not connected.
- Catalog has dated real merchant listings, not live inventory. Automated refresh, commercial reuse rights and merchant agreements still require work.
- No real payment, carrier API, email/SMS provider, automatic live FX feed, binding customs calculation, public registration or production ledger. Tracking is operator-entered.
- RU/UZ/EN navigation and chosen communication language are available, but detailed transactional screens still need a complete translation pass.
- Email/password or email-code sign-in, optional Google linking, phone verification, staff roles, audit log and backups require chosen providers and production secrets.
- Passport OCR is best effort; unsupported browsers fall back to manual confirmation. There is no government identity validation, liveness check or customs gateway.
- Translations for detailed legacy screens are still being expanded; the language selector covers the shared shell and preference first.

## Decisions not to lose

- Never turn unknown shipping into zero.
- Persist raw source URL, currency, price, shipping, country, boxed weight, source image and declaration with imported products/orders.
- Keep sourceShippingEstimated separate from shippingKnown.
- Server domain actions and compare-and-swap revision own all state changes.
- D1 holds one JSON State per user; do not replace it without a data migration.
- Do not describe the prototype as commercially live.
- Passport bytes belong in private R2 paths; D1 stores owner-scoped metadata and account state stores only confirmed fields plus a masked number.

## Pricing, approvals, warehouse and catalog release — 12 September 2026

- Quote lines now remain mathematically independent: base international freight no longer contains the delivery margin, and the total adds that margin exactly once. Cart, order details and operational fee projections include service, buyout, conversion, freight margin and optional-service lines without omissions.
- Managed percentage fields are edited as percentages in the operator UI and may be set to zero. Submitted quotes remain immutable and retain their fee-rate snapshots.
- Orders can carry optional change requests for price, variant, substitution, merchant shipping, warehouse services or customs data. Only the operator can create a request; only the owning customer can approve or decline it; the server checks the expected amount and blocks progress while a request is pending. An approved variant request updates the order snapshot while preserving the original quote.
- Warehouse intake records condition, received quantity, notes, requested photo/repacking/consolidation/split/fragile operations and an optional parcel group. Weighing is unavailable until intake is recorded; damage or mismatch requires an approved customer resolution.
- Catalog cards show their observation date. Snapshots are automatically hidden after their source-expiry time, and the administrator catalog screen can recheck every allowlisted source through the protected importer. A successful check does not silently change the editorial price; a changed value still needs operator review and a new snapshot.
- The new approval, warehouse, catalog and finance surfaces are responsive down to the mobile layout. Shared navigation, feed, cost lines, customs estimator, legal documents and selected operational labels support RU/UZ/EN; untranslated legacy transactional copy remains tracked as a launch issue.
- Verification for this release: 38 domain/security tests, TypeScript, lint, production build, authenticated API smoke including customer approval and warehouse intake, plus the 126-check desktop/mobile browser audit passed.

## Checkout clarity and customs estimate — 11 September 2026

- Catalog now prioritizes sourced item price, compact merchant discount, delivered estimate and next action. Detailed quote lines remain in the product sheet; weight margins are no longer repeated on the primary surface.
- Standalone /customs calculator and product/link/cart estimates are read-only and separate from Atlas totals. Cart merchandise/quantity is aggregated before applying one monthly allowance.
- Ordinary personal courier regime: $200/calendar month (PKM-244); unified payment on excess, without adding VAT again (PP-4508). Use 30% / minimum $3 per dutiable kg before 2027-01-01 and 20% / $2 from that date as explicitly scheduled in UP-174 section 8. Consolidated PP-4508 already displays the amendment; the estimator follows the originating decree’s stated commencement date.
- PP-136 bonded warehouse/registered e-commerce platform experiment is distinct: selected 3% plus VAT or unified 5%, not generic 5% plus VAT and not the courier exemption model.
- User provides arrival date, other imports in that calendar month, and additional customs value. Unknown dutiable-weight allocation produces a lower/upper illustration using value-based charge and supplied gross-weight cap; it is not a customs decision. Without weight, show a lower bound. No extra fees or special restrictions are automatically assessed.
- This pass: 34 unit tests, lint and production build passed; browser interaction/visual QA not performed.
## Guest, customer and administrator interface — 11 September 2026

- The provider exposes explicit loading, guest, authenticated and connection-error states. A 401 clears the previous user, revision and all private account state before rendering; expired writes return to the guest gate.
- `AccessView` gates every member and administrator route before its forms mount. Guest sign-in retains the relative route and product URL. Catalog, legal terms and customs information remain public.
- Guest home has a dedicated introduction and catalog-only navigation. Save, cart, balance, notifications, documents, batch import and orders are hidden until sign-in. Product order actions lead to sign-in and return to the chosen product flow.
- Customer navigation never exposes administrator links. Admin, operations and analytics require both an authenticated session and the server-derived operator flag; `/api/operations` independently rejects customer reads and writes with 403.
- Guest language is stored as a device preference until an account is available. Authenticated language continues to persist through the account action.
- The UI audit covers guest/customer sign-in and sign-out, 13 protected routes, public pages, three administrator denials, server operator denial, error/retry, three languages, inactive empty forms, semantic names/IDs/links, and 1440/800/390 px layouts.

## Legal and operational foundation — 11 September 2026

- `/legal` now contains a structured Russian governing draft: public offer for purchasing-intermediary and logistics-agent services, privacy policy, separate passport-data consent and payment/cancellation/refund policy. It discloses buyout, service, delivery, conversion and optional-service income separately. Company name, registration/tax data, address, support contacts and bank details deliberately remain launch blockers rather than invented facts.
- The payment policy names Uzcard, Humo, Visa and a separate crypto channel only as planned integrations. No method is shown as available and no real payment is accepted.
- D1 migration 0004 adds normalized customer, order, fee-line, order-event, legal-consent, staff-directory and audit-event tables without deleting or changing legacy JSON accounts. The current customer flow remains compatible; relational order backfill/dual-write is a later controlled migration.
- Every successful account write now also maintains a rebuildable operational projection across customers, orders, separate fee lines and status events. Projection failure never corrupts or rolls back the compatible customer record; the administrator can rebuild all current profiles and inspect row counts from `/admin`.
- `/admin` now includes customer access control (`active`, `review`, `blocked`), a cross-customer support queue with replies, internal finance totals, and a database-integrity workspace. Review blocks checkout/payment confirmation; blocked profiles cannot write through the customer API. These checks are server-side.

## Fees, documents and resilience — 11 September 2026

- Managed pricing has separate optional rates for purchase handling, conversion and delivery margin plus a flat additional-services amount. New quotes record each non-zero component; submitted orders remain immutable and old quotes parse with zero defaults.
- Operator invoice, purchase proof, warehouse photo and warehouse report files are stored privately in R2 with owner/order metadata in D1. Customers can download only their own order documents; only the primary administrator can upload.
- The administrator system screen shows captured server failures and provides an authenticated JSON export of operational D1 data with a SHA-256 checksum and audit record. Passport and order-document bytes are intentionally excluded; this export does not replace encrypted off-platform R2 backups.
- New fee labels, order-document controls and administrator navigation/system labels have RU/UZ/EN variants. The remaining legacy operational copy still requires a complete professional translation pass.
- Mobile rules keep administrator tabs scrollable, stack uploads and settings, enlarge touch targets and prevent order/document rows from overflowing narrow screens.
- `/admin` is now an operator control centre with overview metrics, order/analytics shortcuts, staff directory, server-managed restrictions and recent audit events. Staff records are preparatory only: until standalone authentication is connected, only `ATLAS_OPERATOR_EMAIL` has server authorization.
- Operator order changes, pricing, policy and staff-directory updates create audit records. The authenticated smoke test covers staff creation and audit visibility in addition to the full order flow.
