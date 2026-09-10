# Atlas — project context

## Product

Atlas is a functional cross-border shopping prototype for customers in Uzbekistan. A user chooses a demonstration catalog item or pastes a foreign-store product link, receives an editable preliminary UZS calculation, creates a simulated order and follows its simulated purchase/warehouse/delivery process.

It is not yet a commercial marketplace: no real payment, purchase, carrier booking, customs filing, money transfer or delivery takes place.

Published URL: https://atlas-uz-market.ishakovzakir0.chatgpt.site  
Handoff baseline: commit 114c4cedd17567b799bfcfb5a0671e83d6c59d73, published version 8.

## Customer flow

1. Open catalog or Заказ по ссылке.
2. Paste a public supported-store product URL.
3. The server imports available title, photo, brand, price, currency, source country, category, declaration draft, variants and weight.
4. Customer checks/edits the source data, selects size/colour/model and adds to cart.
5. If store shipping is unavailable, the form starts with editable $10 reserve.
6. Customer accepts customs conditions and completes simulated checkout. One cart line becomes one order.
7. Operator confirms estimated merchant shipping, purchase, warehouse receipt, settlement and dispatch status.
8. Refunds appear as demo balance credit; extras require approval before the order proceeds.

## Current routes

| Route | Function |
| --- | --- |
| / | Demo catalog, favourites, filters and quick link entry |
| /order-by-link | Import product and create quote |
| /cart | Cart, balance use, customs consent, simulated checkout |
| /orders | Customer orders, photo refresh and extra approvals |
| /operations | Operator workflow, currently only own account orders |
| /account | ChatGPT profile and one-time legacy demo import |
| /balance | Demo ledger/balance |
| /favorites | Saved catalog items |
| /customs | Customs guidance and consent |

## Roles and authentication

Customers authenticate through platform-owned ChatGPT routes. Atlas account identity is email:<lowercase email>. This was intentional: some hosted requests provide authenticated email but omit platform user ID. app/chatgpt-auth.ts treats platform ID as optional; lib/market/server.ts migrates an old platform-ID row into the email-based account. Do not reverse this without a migration.

An operator is an authenticated customer whose email matches secret ATLAS_OPERATOR_EMAIL. Client UI is not authorization: operator checks occur in server actions. There is no standalone email/password/phone registration.

## Business logic and price calculation

Demo pricing lives in lib/market/domain.ts and lib/market/world.ts:

| Item | Current demo rule |
| --- | --- |
| UZS per USD | 12,800 |
| Service fee | 12% of merchandise |
| International freight | 90,000 UZS / chargeable kg |
| International reserve | 20% of international freight |
| Dimensional divisor | 5,000 |
| Shipping mass | boxed kg + 0.3 kg + 0.2 kg |

Quote is merchandise + merchant-to-warehouse shipping + service fee + international freight + international reserve. Source shipping is per unit and quantity currently multiplies it conservatively.

Supported static source currencies: USD, EUR, GBP, RON, CNY, TRY, JPY, KRW, AED, CAD and AUD. RON exists for Zara Romania at static 0.23 USD/RON. These are demo conversions, not live FX.

## Shipping, balance and recalculation

Unknown store shipping uses editable $10 and sourceShippingEstimated true. Before a reserve-based order leaves status Ожидает выкупа, an operator enters actual total merchant shipping in USD:

- actual lower than reserve: customer-credit ledger entry immediately;
- equal: no adjustment;
- higher: customer must approve an extra.

Warehouse settlement compares actual and dimensional mass with quoted international freight plus reserve. Lower actual freight credits balance; an extra blocks delivery until approved.

Balance is a demo accounting view derived from entries in account state. It cannot receive real deposits or withdrawals. Orders retain immutable original quotes. Automatic cancellation is available only before purchase and returns full simulated amount to demo balance.

Order statuses: Ожидает выкупа → Выкуплен → На зарубежном складе → Готов к отправке → В пути → Доставлен.

## Importing stores and product data

POST /api/import is signed-in, same-origin and rate-limited to 12 imports per user/minute. lib/importer/stores.ts contains a static explicit allowlist of more than 100 store/brand domains. Importer validates HTTPS, port, credentials and every redirect to prevent SSRF. It uses public browser-like requests, no customer cookies, a 15-second timeout and 3 MB decoded HTML cap.

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
- Warehouse actual/dimensional settlement and balance credits.

## Partial or missing

- Store parser quality varies; only Zara has the detailed adapter.
- Store shipping is frequently destination/session-dependent; $10 is reserve only.
- Operations is not a multi-customer staff queue.
- Catalog is illustrative, not inventory.
- No real payment, carrier, tracking, notification, live FX/tariffs, customs calculation, public registration or production ledger.

## Decisions not to lose

- Never turn unknown shipping into zero.
- Persist raw source URL, currency, price, shipping, country, boxed weight, source image and declaration with imported products/orders.
- Keep sourceShippingEstimated separate from shippingKnown.
- Server domain actions and compare-and-swap revision own all state changes.
- D1 holds one JSON State per user; do not replace it without a data migration.
- Do not describe the prototype as commercially live.
