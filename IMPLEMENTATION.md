# Atlas — world sourcing and account-backed prototype

Based on the supplied marketplace blueprint and Funds, Weight & Settlement supplement.

## Added in this revision

- World-wide product origin selection, including a named custom country, with country labels and a country filter in the illustrative catalog. eBay domain is never treated as proof of the seller's actual origin.
- Authenticated server-side product importer with JSON-LD Product / Offer and Open Graph extraction. Supports an explicit set of merchant domains including regional eBay, Amazon, Zara, Mango and other stores. Extracts available title, image, price/currency, shipping, and structured weight data; missing fields remain unknown and can be filled manually. Source title is preserved in its original language, not machine-translated.
- Shipping destination/currency is retained. Known matching shipping estimates can prefill; unmatched/unspecified estimates require an explicit user decision. Unknown shipping is not silently accepted as zero at checkout. User confirms data and origin before adding.
- Boxed weight input, category-based approximate defaults, and transparent +0.3 kg packaging +0.2 kg uncertainty. Shipping is later settled against actual/dimensional weight. This mass allowance is separate from the displayed monetary reserve.
- Source shipping is a separate quote component; source currency/price, country, boxed weight, allowance and source image survive cart and order persistence. Server actions recompute demo currency conversion and padded weight rather than trusting supplied converted amounts.
- Product images in carts and orders; existing orders with a retained source URL can request a missing photo without modifying their original quote.
- Personal account: dispatch-owned ChatGPT sign-in, automatic first-visit account creation, separate server-backed state per stable authenticated Site user, email/name display, sign-out. No separate email/password or phone registration.
- D1 schema/migration for account state, optimistic revision and import quota. State-changing actions are replayed on the server, scoped to authenticated identity. They cannot replace arbitrary state except explicit one-time legacy demo import into an empty profile.
- Warehouse/purchase actions require an operator email configured as a secret runtime value. Current operator UI manages that operator's own test account; a cross-customer operations queue remains a follow-up.
- Explicit migration of old browser-local demo data into an empty signed-in profile; old data is not deleted or silently assigned.
- Customs reference page, checkout checkbox, and persisted consent version/time per order. $200 courier calendar-month threshold and $100 postal norm are explained separately. Customs charges are not quoted or silently deducted; external monthly purchases are unknown.

## Sources for customs text

Reviewed 9 September 2026:
- https://lex.uz/acts/2876352 — Customs Code, Article 169: noncommercial excess is subject to the unified customs payment.
- https://t.me/s/customschannel/46341 — Uzbekistan Customs official channel, Cabinet Resolution 244 of 19 April 2025: courier $200 and postal $100 norms from 1 May 2025.
- https://www.customs.kg/site/ru/master/customskg/news/k-svedeniju-uchastnikov-vneshneehkonomicheskoj-dejatelnosti — official customs explanation of Uzbekistan's calendar-month courier limit.

No fixed customs duty percentage is implemented. Actual taxes/fees require carrier/customs validation for the shipment and current law.

## Runtime security and consistency

API handlers obtain identity only from the starter's platform-authentication helper, scope database access by that ID, reject missing identity, require same-origin POSTs, cap input bytes and persist state with a compare-and-swap revision. No buyer-controlled user ID or role is accepted. Operator policy comes from secret `ATLAS_OPERATOR_EMAIL`, never from client claims. User API responses are no-store.

Import fetches have a strict domain allowlist, HTTPS/port/credential validation at every redirect, no visitor cookies or auth headers, 10-second timeout, bounded redirects and a 2 MB decoded response limit. D1 limits imports to 12 per user per minute. Bot challenges and denied/oversized/non-HTML pages fail to manual entry. Untrusted markup is not injected into the page. Images render as images with a no-referrer policy and fallback.

Checkout remains simulated: no payment gateway, real cash, real shipping reservation or actual purchase is executed. Price/FX and all international route tariffs remain DEMO values; source prices can be genuine observations but require variant/availability verification. Source shipping entered per unit is conservatively multiplied with quantity; actual combined-shipping needs operator verification. Boxed weights are estimates unless verified by warehouse evidence. D1 JSON state is a prototype architecture, not the blueprint's full PostgreSQL ledger/outbox/reconciliation implementation.

## Verification

- TypeScript validation and production build.
- 17 domain/import tests: earlier quote/cart/ledger invariants plus metadata extraction, unknown costs, aggregate-offer rejection, unit conversion, +0.5 kg applied once, SSRF/redirect rejection, response cap, source-currency recalculation, consent requirement, operator permission and quote preservation on photo changes.
- Applied generated SQL in an isolated SQLite database and checked per-account state isolation, revision-conflict rejection, and quota increments.
- Tried fetching the real listing https://www.ebay.es/itm/389916299901 from this environment. It timed out; successful live eBay import is NOT verified. The published runtime will still need end-to-end confirmation after deployment.
- Browser UI, platform sign-in redirects and deployed D1 behavior were not exercised. Migration files are included in the built deployment output.

## Follow-up integrations

For reliable high-volume eBay sourcing, configure an authorized eBay Browse API application rather than relying on page markup. Official documentation:
- https://developer.ebay.com/api-docs/buy/api-browse.html
- https://developer.ebay.com/api-docs/static/oauth-credentials.html

No eBay API credential or API adapter is currently configured. No anti-bot workaround is implemented. Public customer onboarding beyond ChatGPT, provider-backed payments, current FX, real country-specific carrier tariffs, global customer operations, customs calculation and production legal/privacy readiness remain future work.
