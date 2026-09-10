# Atlas — project context

## Product

Atlas is a functional pre-release cross-border shopping prototype for customers in Uzbekistan. A user chooses a demonstration catalog item or pastes a foreign-store product link, receives an editable preliminary UZS calculation, saves a recipient/address, creates a simulated payment and follows the purchase, warehouse, parcel and delivery process.

It is not yet a commercial marketplace: no real payment, purchase, carrier booking, customs filing, money transfer or delivery takes place.

Published URL: https://atlas-uz-market.ishakovzakir0.chatgpt.site  
Handoff baseline: commit 99f2fbcc0c7735c0bc9ff778b9dd1011731847d0, published version 12.

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
| / | Demo catalog, favourites, filters and quick link entry |
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

Customers authenticate through platform-owned ChatGPT routes. Atlas account identity is email:<lowercase email>. This was intentional: some hosted requests provide authenticated email but omit platform user ID. app/chatgpt-auth.ts treats platform ID as optional; lib/market/server.ts migrates an old platform-ID row into the email-based account. Do not reverse this without a migration.

An operator is an authenticated customer whose email matches secret ATLAS_OPERATOR_EMAIL. Client UI is not authorization: operator checks occur in server actions. There is no standalone email/password/phone registration.

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

- The home screen explains the path from a store link to a preliminary calculation, confirmation and status tracking. It also includes a supported-store preview, FAQ and clear pre-release/trust notices.
- A profile can store several recipient addresses. The chosen primary recipient remains compatible with checkout and declarations. Customer support requests are retained in that customer's account state; staff response workflow still needs an operational queue.
- The document centre links to passport confirmation and declaration previews, explains the availability of future invoices/warehouse photos, and exports profile data. Passport source files remain private and are not placed in the JSON profile export.
- The monthly total is an informational sum of Atlas test orders, not a customs calculation or an official limit balance.

## Partial or missing

- Store parser quality varies; only Zara has the detailed adapter.
- Store shipping is frequently destination/session-dependent; $10 is reserve only.
- Operations supports one configured operator email. Team assignment and notes work, but independent staff identities and permission roles are not connected.
- Catalog is illustrative, not inventory.
- No real payment, carrier API, email/SMS provider, automatic live FX feed, customs calculation, public registration or production ledger. Tracking is operator-entered.
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
