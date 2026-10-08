# Atlas — project context

## eBay: фото расцветок, размеры и наличие — 8 октября 2026

Исправлена потеря фото из eBay Browse API: разрешён только точный официальный CDN assets.adidas.com в дополнение к i.ebayimg.com. Галереи привязаны к расцветкам; каждая строка корзины получает собственную галерею и точный var в ссылке. Сохраняются все подтверждённо доступные цвета и размеры группы; недоступные, неизвестные и нулевые остатки исключаются из импорта и выбора; сервер блокирует подтверждённо распроданные варианты. Админский черновик сохраняет остатки, обозначения размеров и галереи; новые поля схем необязательные, старые данные совместимы. Для мужской обуви adidas показаны US/UK/EU и официальная длина стопы в см; зависимые размеры eBay не считаются отдельной осью. Nike и другие таблицы сохранены.

Все 744 теста и TypeScript проходят. Production build/lint проверяются перед публикацией. Живое наличие и фото проверяются после публикации; эти данные не гарантируют будущую доступность. Полный автоматический админский publish, изменение хранения и таймеры из присланного справочного текста в этот релиз не включены.

## eBay colour galleries, size formats and exact child links — 8 October 2026

The reported group had no photos in the version-149 import response. Image extraction now supports thumbnail images and primary group photo fields, and creates exact-child colour galleries. Customer loading retains all eBay galleries when the original link selects one colour. Each chosen cart line rewrites var to its own sourceVariantId while preserving affiliate parameters; stock/price/identity checks remain. adidas men's US footwear offers US/UK/EU display using the official adidas chart, preserving the original seller size/ID and not applying Nike, women's or unrecognized charts. Existing optional schemas and D1 remain unchanged. 742 tests, lint (existing unused Choice warning), TypeScript and Worker build passed. Regression covers gallery colour separation, affiliate URL rewriting and brand/gender size gates. Verify actual colour photographs after publication; a sparse missing-image log records only field keys/types and image hostnames, never credentials or upstream bodies. Native runtime, accounts and orders are unchanged.


## Full eBay group for customer and operator — 8 October 2026

The user requested every in-stock colour/size from a seller group in both customer link ordering and admin catalog import. Official Browse group JSON now has a separate finite 8 MB body budget; OAuth/single-item limits remain unchanged at 32 KB/1 MB. Existing timeouts, exact group identity, 250-variant limit and safe images remain. Unknown-stock, known-unavailable and explicit zero-quantity variants are excluded from selectable eBay groups. Each returned option retains its ID, seller dimensions, price, photo and stock data. An explicit var selects its child by selectedVariantId; customer source-colour filtering exempts exact supported eBay hosts, so sibling colours remain selectable. Other stores retain their colour-bound links. Operator importDraft already preserves the shared group's full variant matrix.

The preceding exact-child fix remains a fail-safe if a group request cannot be read; normal groups are always requested first. The initial 9eb2eaf source/archive was prepared but not saved/deployed; this broader group release replaces it. No migration, pricing formula, secret or real order changes. Tests include >1 MB successful colour/size group, operator draft preservation, customer eBay colour exposure versus Nike/lookalike hosts, unknown/sold-out/zero-quantity exclusion, and an oversized >8 MB fail-safe that never substitutes a parent child. 739 tests pass; complete final lint, TypeScript/build and deployed actual-user-link checks before claiming production success.


## eBay explicit variation / group failure fix — 8 October 2026

User listing 157751149633?var=459304625551 (including affiliate parameters) reproducibly returned HTTP 422 on version 148. Worker diagnostics identify browse_variants/status=200: the complete group response was rejected by bounded JSON reading after the exact child endpoint succeeded. The fix retains the verified child from getItemByLegacyId when group reading fails, mapping only its authoritative identity/price/availability/photos, setting selectedVariantId and keeping the requested source URL. Parent links still require full group data; a mismatched, unavailable, auction or incomplete child never falls back to another variant. Existing one-megabyte limit and timeouts remain. Normal successful group imports continue unchanged.

Regression tests cover an oversized group with an explicit matching child and rejection of a parent with the same oversized group. All 738 tests pass; final lint, TypeScript/build and a fresh deployed check of the actual user URL remain required before claiming fixed. No account/order/D1/environment changes. Deploy with the Sites hosting workflow from this current release checkout and preserve Impact and current features. This preparation snapshot does not itself confirm publication; root handoff records final deployment evidence.


## Impact head verification follow-up — 8 October 2026

The user explicitly requested the partner tracking code in the main homepage head for Impact Add Website verification. RootLayout now emits script#atlas-impact-bootstrap in the server-rendered head with the exact partner script URL and both requested commands. This defines atlasStartImpactTracking; current consent still controls its invocation and external loading, and native shells remain excluded. The original queue-style bootstrap gains only a duplicate-load ID. Existing client bootstrap calls the head initializer when available and retains its earlier fallback. A new VM regression verifies static URL visibility, no load on head evaluation, both commands after start and no duplicate load. All 736 tests pass; final lint (zero errors; one existing unused Choice warning), TypeScript and Worker build passed before this follow-up publishes. Version 147 remains the last confirmed deployed version until the next successful deployment is recorded.


## Import33 and Impact release preparation — 8 October 2026

This release starts from the currently published Site version 146, commit 4c61312ad439e98566785e10ab2f3c55d0faa556, preserving its newer account, ordering, pricing, discount and mobile features. Source checkout: outputs/deploy-import33-20261008. User explicitly requested publication to atlasmarket.uz. Publication is pending until a succeeded Sites deployment is recorded; do not infer it from this document.

All 33 requested storefronts are registered in the shared customer/operator importer. New customer additions use sourceManuallyConfirmed:false and require server verification, without a data-confirmation checkbox or manual price override. Exact option identity, public native state, partial details and bounded transient retry are improved; Zara colour/sizes/RON and old stored carts remain compatible. Representative US page evidence covers 17 merchants plus production eBay Browse API; this does not certify all 33. Blocked pages and missing prices remain unresolved.

The owner's Impact tag P-A7926226-1901-4a82-b369-ac46d499149f1 loads asynchronously once in the web application after the existing current-version consent; commands are transformLinks and trackImpression. Legal text and consent version 2026-10-08 disclose partner tracking. Native Capacitor shells do not load this tag. No explicit account, passport, balance or order payload is sent by this bootstrap.

735 automated tests and TypeScript pass. Targeted synthetic Chromium checks pass for size-to-cart without manual confirmation, partial Target/retry, mobile layout, exact Impact commands and zero tracking requests before guest consent. No production account/cart/order writes. The older broad audit-ui harness times out on its unchanged synthetic guest-navigation flow; retain this limitation. Final lint, TypeScript, all 735 tests and the production Worker build passed before publishing.


## Магазины 2.0 и Каталог 2.0 — 6 октября 2026

Владелец попросил сделать разделы «Магазины» и «Каталог» «внушительно, красиво, умно и user friendly». Разбор показал, что слабость была не в дизайне, а в данных: все 24 встроенных товара устарели (срок жизни снимка 7 дней), скидки у импортированных товаров терялись, плитки 207 магазинов были одинаковыми и не отвечали на вопрос «откуда, за сколько и как быстро». Теперь страница магазинов открывается компактно: поле ссылки, свёрнутая подсказка «как скопировать ссылку», шесть карточек стран отправки с днями и тарифом обеих скоростей (клик фильтрует магазины по стране), полка «Витрины с товарами» с фото и «≈ от N сум с доставкой», плитка магазина с флагом, сроком, тарифом и счётчиком товаров в каталоге; карточка магазина начинается с поля «Вставьте ссылку с nike.com», показывает условия доставки из страны магазина, товары бренда в каталоге, витрины по странам с валютой (и честную пометку, если курс валюты ещё не поддерживается) и короткую заметку об особенностях магазина; у карточки есть адрес `/stores?brand=nike`.

Каталог получил полосу подборок с коллажами из фото товаров (операторские подборки и автоматические: «До 300 тыс. сум», «Со скидкой», «Новое», «Из Nike», «В лимите $200» для вошедших), карточку 2.0 с честной компактной подписью устаревшей цены («Цена магазина · 13 сент»), строкой фактов «США · 5–9 раб. дн · ≈ 1,2 кг», не более чем двумя подсказками-чипами («+N сум к посылке Nike», «В лимите $200», «Доставка магазина бесплатна», «Сверим перед заказом», «Уже в корзине») и разбивкой итога во всплывающей подсказке; лист товара открывается для всех карточек, показывает переключатель экспресс/обычная с экономией и на телефоне поднимается снизу. Поиск понимает русские и узбекские слова и написания брендов («кроссовки», «найк», «виктория сикрет»). Оператор может подтвердить наличие товара сам и опубликовать карточку, когда магазин блокирует проверку, и задать позицию товара на витрине; у импортированных товаров появилась скидка относительно цены магазина «до».

Что по-прежнему требует решения владельца (подробно — локальный документ `outputs/proposals/stores-catalog-2026-10-06.md`, раздел 8): автоматическая републикация карточек при неподтверждённом наличии, срок жизни снимка, курсы SEK/DKK/PLN/CHF/CZK, скорость воркера обновления, навигация «Товары | Магазины» для вошедших на телефоне, отдельные страницы магазинов и хранение каталога больше 100 записей. Цена и наличие остаются подсказкой: Atlas сверяет их с магазином при добавлении в корзину и перед оформлением.

## Мобильные приложения для App Store и Google Play — 6 октября 2026

Владелец принёс чек-лист из 10 требований сторов, и Atlas получил тонкую нативную оболочку на Capacitor (`mobile/`, ветка `feat/mobile-apps`) поверх сайта `atlasmarket.uz`, а не отдельное приложение. Как закрыт каждый пункт (подробно — `MOBILE.md` §2): не «просто обёртка» — нативный Sign in with Apple, системный браузер с возвратом в приложение, share sheet, haptics, офлайн-страница, universal links; раскрытие ИИ — раздел политики и текст на экране распознавания документа (OCR на устройстве, без сторонних сервисов и генеративного ИИ); политика и условия — публичные `/privacy` и `/terms` (те же документы, что на `/legal`, с новыми разделами о приложениях, входе через провайдеров, удалении, согласии и возрасте); удаление аккаунта — из кабинета (Настройки → Удалить аккаунт) и по публичной инструкции `/delete-account`; «Восстановить покупки» — честная строка: встроенных покупок и подписок нет, кнопка лишь перечитывает аккаунт; Sign in with Apple — рядом с Google; никаких придуманных рейтингов, отзывов и счётчиков — контакты и ссылки на сторы берутся только из `siteContent` и до заполнения не показываются; согласие на обработку данных — плашка при первом визите, запись в аккаунте и в `market_legal_consents`; страница приложения `/app` и поддержки `/support`.

Что остаётся симуляцией: оплата, выкуп и доставка — как и прежде; в приложении нет покупок через App Store/Google Play, поэтому Apple и Google не являются сторонами договора. Push-уведомления, биометрия и приём ссылок через системный share запланированы, но не реализованы.

Что должен дать владелец до подачи: аккаунт Apple Developer (Team ID, App ID `uz.atlasmarket.app`, Services ID, ключ `.p8`) и Google Play Console (Play App Signing, SHA-256 ключей), переменные `APPLE_*`, `ANDROID_*` и `ATLAS_REVIEW_ACCOUNTS` в Sites, миграцию 0010 на рабочей D1, контакты поддержки и реквизиты в `siteContent`, скриншоты, описания RU/UZ/EN и ответы App Privacy / Data safety, юридическую проверку новых разделов документов и решение о переводах на узбекский и английский, возрастной рейтинг «только для взрослых» (17+ в App Store, 18+ по IARC). Сборка iOS возможна только на macOS с Xcode; живые потоки Apple не проверялись.

## Две скорости доставки, тарифы на главной, роли сотрудников, бухгалтерия — 6 октября 2026 (вечер)

Владелец ввёл два тарифа международной доставки: экспресс $15,98/кг (5–9 рабочих дней из США, 7–9 из остальных стран) и обычная $13,98/кг (9–14 рабочих дней); клиент выбирает скорость в корзине и в расчёте по ссылке, по умолчанию — экспресс, одна скорость на всю корзину; комиссия Atlas — ровно 9,98 % от товаров. Раздел «Сроки и тарифы» на главной стал карточками стран с флагами и обеими скоростями, а цифры больше не меняются после загрузки страницы, потому что первый рендер берёт тариф с сервера. «Мои заказы» группируются по оформлению и магазинам; отменить заказ теперь может только оператор. Сотрудники из справочника получили роли с реальными правами (администратор, финансы, поддержка, закупки, склад) — вход только по коду на email или через Google. Бухгалтерия дополнена годовой таблицей с кварталами, фактической маржой по заказам, закрытием периода, обязательствами, курсами для записей журнала и исправлением записей; ставка налога и схема по-прежнему ждут подтверждения бухгалтера.

Вторая волна того же вечера. Книги ведутся почти сами: при каждом изменении заказа сервер создаёт и поддерживает автозаписи журнала (оплата, оплата балансом, выкуп, доставка магазина, пошлина, возвраты на внутренний баланс), а оператор вводит вручную только перевозчика, комиссии банка и прочие расходы; есть сверка месяца с объяснениями, денежная позиция, налоговый календарь-ориентир, полная книга месяца, JSON-бэкап, импорт банковской выписки с отдельным подтверждением администратора и печатный счёт-расчёт по заказу (не фискальный документ — оплата, выкуп и доставка по-прежнему симулируются). Бухгалтерия и админка разбиты на вкладки: обзор с KPI и списком «Требуют внимания», карточка клиента с заметками операторов, команда с отключением сотрудника по причине, фильтруемый журнал, статус системы и сводка действующего тарифа. Контакты, юрлицо, способы оплаты, отзывы (только с согласием клиента), фото посылок и число доставленных заказов владелец редактирует во вкладке «Контент сайта», а не в коде.
## Tariff r4, link-order sheets, swipe gallery, Telegram bot sign-in — 6 October 2026

The owner saw a 10.98% fee "everywhere" and asked for $14.98 per kg. The code fee was already 9.98%; a saved tariff carried a 1% buyout or conversion percent on top. Tariff revision 4 sets $14.98/kg, 9.98%, zero buyout/conversion/delivery margin and drops per-country rate and fee overrides once; later admin edits stay. The link order lost the grey "set by Atlas" note (its snapping sheets were tried and removed the same day: they made choosing a size hard); product photos slide and settle with animation everywhere; chip rows settle on a card edge; the catalog snaps only at its ends. Names get capitals on every word and addresses on the first letter while typing. Sign-in through Telegram no longer goes through the widget's oauth.telegram.org page: one tap opens the Telegram app with a one-time token, the bot asks to confirm, and the page signs in by itself; `/login` shows Telegram first and the other methods as a column of buttons (Google included).

## Home sheets — 5 October 2026

The owner asked for the home page to read as separate full-screen parts that snap into place "like a magnet", with nothing of the next block showing at the bottom of a screen. Each part is now one screen (`app/home-chapters.css`): on phones the hero, the example bill, how it works, product selection, rates, money, order tracking, FAQ and the footer; on wide screens the hero with the bill, then one sheet per section and a last sheet with the closing card and the footer. The product selection is one swipeable row of 8 cards (‹ › on wide screens). Real iPhone, Mac trackpad and Windows wheel checks are still open (TODO.md).

## Simpler bill, customs paid through Atlas, checkout straight to the order — 5 October 2026

The owner found the bill confusing. The refundable international reserve is gone from the bill (tariff revision 3): the parcel is billed on its estimated weight, and after weighing the difference goes back to the balance or is asked for with consent. Customs is one short block — no duty up to $200 a month, per recipient, including purchases outside Atlas — plus the estimated duty when the cart goes over. "Atlas pays customs for me" is offered in every cart for 4.98% of the goods price (no delivery) and goes into the bill at once, together with the estimated duty for the chosen recipient as a prepayment; when customs names the actual duty, the operator confirms it — the rest returns to the balance, a higher amount needs the customer's consent before delivery. When a store does not state delivery and the order from it is above $50, the delivery field shows 0. "Оформить заказ" now opens the new order in My orders, where it waits for payment; a payment provider's page will go in between once one is connected.

## Books, customs at checkout, discounts, ID card OCR — 6 October 2026

The owner asked for a database the accountant can work from, with profit tax. Atlas is treated as a purchasing agent: money for goods, store delivery and customs is transit, Atlas income is its fee, delivery, the 1.2% rate markup and services; operators record real costs in a ledger; a month shows profit and profit tax at a rate the owner sets (15% until the accountant confirms) and exports CSVs for Excel. Customs choices (limit already used, help paying customs at 3% of the goods) moved to the checkout confirmation; store discounts are shown crossed out wherever a store price appears; passport OCR now works in every browser and reads the Uzbek ID card; delivery days are edited in the admin.

## Atlas Day — 5 October 2026

The owner found the light theme "good but too simple" and asked for it to feel more expensive, elegant, trustworthy and clear. The direction chosen after a critique of every page and a judging panel was the folio: Atlas shows the whole bill before you pay, as a white sheet in a folder, with what is not in the amount to pay on a separate slip. After seeing the first pass the owner turned back four things the same day: the serif typeface (especially its digits), boxless catalog cards, the dark bottle green everywhere ("gloomy") and one price for all countries. The light theme now keeps the folio idea in a light mint folder, uses Inter everywhere (the owner found Manrope's figures uneven in long soum amounts; only the logo keeps Manrope), brings back white highlighted cards, the previous catalog card with its discount pill, the brand green for actions with light accents kept to a few places (a brighter emerald everywhere looked "acid"; balance matters), and a per-country price in the rates table. Trust comes from true, specific facts (price re-checked with the store, CBU rate plus 1.2%, 9.98% fee on items, unknown store delivery kept outside the total, extra charges only with consent, the allowance per recipient), never from invented reviews, counters or partner logos. The owner also made the postal code required for every delivery address.

## Order calculation — 5 October 2026

The calculation follows the owner's rules. A parcel is billed on its boxed weight plus 0.3 kg once (at least 1 kg); the weight comes from the store or is an editable estimate. The Atlas fee is 9.98% of the items only. Soum amounts use the Central Bank of Uzbekistan's USD rate × 1.012, read by the server and shown with its time. When a store does not state delivery to the warehouse, delivery is free for more than $50 from that store; below that a $10 hold is kept apart from the order amount, and a higher actual charge needs the customer's consent. Customers can add several sizes at once with quantities, see eBay stock, leave a comment for Atlas, and see a customs estimate per recipient for the calendar month ($200 duty-free, 20% above it), including purchases elsewhere and an optional "Atlas helps pay customs" request (3%, a request only). Payments remain simulated.

## Delivery tariff — 4 October 2026

The owner set express delivery at $15 per kg ($1.5 per 100 g) from the US, the UK, China, Germany, Italy and Spain, with approximate times of 5–10 business days from the US, 7–10 from the UK, 7–12 from China and 7–9 from Germany, Italy and Spain. The rate is stored in USD and converted at the Atlas exchange rate, so it follows the rate set by the operator. The home page shows the times and prices per country. Tariffs saved earlier in soum are read as $15 under a new version until an operator saves the form.

## Post-merge polish — 3 October 2026

After the UX redesign reached `main` (#8), a full review found no broken flows but several rough edges, now fixed: every public page (home, stores, customs, legal) has Uzbek, Russian and English versions at `?lang=uz|ru|en`, rendered in that language on the server with matching titles and hreflang, so search engines can show each language; private pages are titled in the page language. Unknown addresses show a localized "page not found" inside the site with ways back. Text contrast meets WCAG AA in both themes, and the operator analytics card is readable in the light theme again. Each page loads only its own code, and unused CSS was removed.

Operators now see field data under Administration → System: anonymous page speed per route (p75 over 7 days) and browser script errors with repeat counts, plus Content-Security-Policy reports. Beacons carry no account, cookie, IP or query string and are deleted after 30 days; the privacy policy draft says so. Security headers are sent by the Worker; the CSP stays report-only until production reports are clean. Before deploying: apply migration `0007_web_vitals` (and `0006_own_auth` with the sign-in secrets).

## Guest link preview — 2 October 2026

Guests can open catalog order links or paste a product link, import public merchant data, select options and inspect the preliminary delivery calculation without signing in. The continuation button asks for authentication before an account/cart mutation. Existing session drafts retain customer-entered link forms across same-tab sign-in; catalog flows retain their exact URL/catalog context and recheck merchant data. No guest account, cart, order or balance is created. Batch import remains member-only. Public catalog responses include current managed pricing so guest estimates do not silently use starter tariffs; payments and delivery remain simulated.

Public import remains same-origin with the existing source/redirect/image/body/time protections. Member limits stay 12/minute; anonymous work has a 60/minute shared ceiling plus 6/minute per hashed edge IP (missing IP shares a conservative bucket). Raw IPs are not stored in rate-limit keys. Cache is shared public merchant data only; actions, checkout and private APIs remain authenticated and server-recomputed. No schema migration.

## eBay Marketplace Account Deletion endpoint — 1 October 2026

The Production Notifications page now has the operator-supplied alert email, the exact `https://atlasmarket.uz/api/ebay/notifications` endpoint and the runtime `EBAY_NOTIFICATION_VERIFICATION_TOKEN`. eBay confirmed the settings were saved; its challenge request and “Send Test Notification” both reached the Worker successfully. The endpoint accepts bounded JSON, verifies the `X-EBAY-SIGNATURE` ECDSA signature against eBay's OAuth-protected public-key API, caches public keys for one hour, returns 412 for invalid signatures and 503 for transient key-service failures, and never writes or logs the notification payload or account identifiers.

The Browse adapter maps listing title, price, variant and image fields; it does not persist eBay member profile IDs, usernames or EIAS tokens. Therefore a valid deletion notice has no Atlas eBay-member profile record to erase. Do not claim the app stores no eBay data or opt out: product listing data is used and cached. The subscription and live test are complete, but they have not yet made Browse item retrieval work.

## Optional official eBay Browse import — 1 October 2026

The eBay importer can use the official Browse API for exact numeric `/itm/.../{legacyItemId}` links when the Site runtime has `EBAY_CLIENT_ID`, secret `EBAY_CLIENT_SECRET`, and an explicit `EBAY_ENV` (`sandbox` or `production`). It exchanges application credentials for a server-only OAuth token, requests the exact legacy listing and—only for seller-defined variation groups—the exact item group. Prices remain per option, eBay seller size/color aspect labels are preserved, known-out-of-stock options are not offered, and requests are bound to the input listing ID and the source marketplace. It never searches by title or borrows a similar listing.

API credentials and tokens are not sent through the New York merchant-page proxy. Production Client ID/Cert ID and `EBAY_ENV=production` are configured in Sites runtime values; secret values remain outside the repository. OAuth now succeeds. A read-only request for a live exact listing still gets HTTP 400 from Browse, so `/api/import` deliberately keeps the safe manual fallback (HTTP 422) and does not assert a title, price, stock or size. The code logs only bounded stage/status/numeric error ID, never the listing URL, response body, token or keys; the available Sites log view exposed the request record but not that console diagnostic, so the exact eBay error ID remains unverified. Production Buy API access may require separate eBay eligibility/approval. Do not treat price, stock or size data as verified until an exact-listing import returns matching data. Seller size labels are not converted to an assumed official or centimeter chart. Dispatch country comes from the listing location; if eBay omits/uses an unsupported location, the order form requires manual confirmation. No D1 schema or saved cart/order fields changed.

## Operator catalog refresh diagnostics — 1 October 2026

Expanded catalog cards in `/admin` now show the stored refresh status, exact bounded last error/detail, last attempt, last successful source response, snapshot date, consecutive failure count and next retry time. The compact card summary prioritizes the stored error over the generic publication issue, so an operator can identify a block, timeout, incomplete response or other parser/source result without inspecting D1 directly. This is operator-only presentation over existing optional `CatalogEntry.refresh` and `CatalogDraft.lastCheckError` fields; it adds no API, D1 write, migration or customer-facing data.

The admin guidance matches the enabled external UpCloud timer: it starts hourly and processes at most five due products from distinct stores; normal freshness is 24 hours and failed sources back off from one to 24 hours. Failures do not count as out-of-stock and do not hide or delete a product. External alerts for repeated failures remain unconfigured; the bounded outcome is available in the systemd journal.

## New York merchant egress and catalog refresh — 30 September 2026

The authenticated Site Worker remains the only customer/API and D1 boundary. Its existing merchant importer can use an optional HMAC-signed HTTPS transport through the dedicated UpCloud VM in New York; importer parsing, the exact explicit store-host allowlist, manual redirect validation, and customer price/option checks remain in the Site code. The VM's Node service is bound to loopback and accepts only fresh signed requests for allowlisted merchant hosts, with bounded request/response sizes, concurrency and timeout. It does not receive account, cart or order state. Local/dev requests continue to use direct fetch when both proxy variables are absent, and a partial production configuration fails closed.

Caddy terminates HTTPS on `85-9-196-196.sslip.io`; this bootstrap hostname is third-party DNS and should be replaced with an Atlas-owned hostname when DNS is available. `ATLAS_IMPORT_PROXY_URL` and secret `ATLAS_IMPORT_PROXY_SECRET` are runtime bindings, never source files. The UpCloud `atlas-catalog-refresh.timer` is enabled as the external hourly HMAC caller for the existing protected Site refresh route; merchant freshness only advances after a successful source check and the existing bounded batch/unknown-stock rules remain in force. Its first signed production call checked five due entries: two confirmed available, while three failed and retain conservative state with hourly-to-daily exponential retry. The systemd journal records failure outcomes; external alert delivery is not configured. No SQL migration or stored account/cart/order schema change was made.

The proxy transport and server contract have automated tests. Signed live Nike HTML and the fixed anonymous Amazon-US ZIP lookup POST both traversed HTTPS and the NYC egress service successfully, and the deployed Site used the same transport during a signed catalog refresh call. This infrastructure does not promise access to every supported merchant or bypass blocks; manual entry and customer confirmation remain the fallback. The timer is enabled; an automatic clock-triggered run is pending at the next hourly boundary.

## Mobile layouts and photo gestures — 30 September 2026

Shared product galleries now support horizontal photo gestures, arrow keys, buttons and localized photo counts in the product sheet, link-order preview and cart. Photo selection is presentation-only: it never selects a product variant or changes a quote. Imported galleries are retained in the existing optional `sourceImages` field when adding to the cart; legacy one-photo carts remain compatible. Authenticated cart actions reject unsafe gallery URLs.

Phone refinements cover catalog touch targets, link forms, cart actions, delivery dialogs, notifications, balance, account/support/address forms, identity, declarations, batch import, all ten admin tabs and the operations workspace. Long values wrap, controls retain readable height and local table/tab scrolling does not widen the document. Figma's existing spacing study was inspected as a design reference; no new Figma mobile design was created.

Chromium checks use synthetic authenticated/catalog/import responses and local image assets at 360/390/402/430/440 px, with additional 768/1440 px customer-route checks. Admin/operations fixtures and customer account/document fixtures are not production records. No D1 data was changed. Physical iPhone/Safari, real merchant imports and live checkout remain unverified; no claim is made about unreleased device specifications.

## Link-order source context recovery — 30 September 2026

Customer-pasted URLs no longer inherit read-only Atlas fields merely because their URL also exists in the public catalog. Catalog context requires an explicit matching product ID and source URL; changing the link releases that context. A blocked/incomplete catalog source retains its valid last-recorded amount and currency as a clearly disclosed preliminary estimate, not a fresh quote. An absent catalog amount leaves price/currency editable rather than creating an empty locked field. Legacy boxed-weight fallback stays finite. Atlas-authored catalog title/category/weight/store shipping remain fixed; fresh source price and option checks, customer confirmation, authenticated server recomputation and checkout verification are unchanged. No D1 state or schema is changed.

Local Chromium smoke uses synthetic account/catalog/import responses for Amazon, eBay, Zara, Sephora, adidas and Nike at 360/1440 px. It verifies pasted-link editing, blocked catalog price retention, fresh-price updates without overwriting Atlas fields, changing links, and 12 intercepted cart requests. No page errors or horizontal overflow occurred and no request wrote to D1. This verifies interface recovery, not live merchant availability or actual production checkout.

## Homepage visual hierarchy and Nike size guide — 30 September 2026

Homepage sections now share a scoped spacing scale: guest hero, catalog controls, responsive product grid, link entry, order steps, store strip, trust panels, collapsible FAQ and footer. The catalog initially renders 12 matches and exposes all remaining matches through “Show more”; search/filter changes reset that display window. All products, source links, saved items, category filters and delivered-cost calculations remain available. Cards use shorter estimate labels and localized UZS suffixes without changing price freshness checks.

Figma was used to capture the current homepage and build an editable catalog spacing study. Local Chromium checks cover guest/member layouts at 360/390/768/900/1440 px, light/graphite appearance, RU/UZ/EN, search, empty results, filters, Show more and FAQ. Public catalog fixtures and a synthetic signed-in account were intercepted in the browser; no D1 records or actual user orders were changed.

Nike US footwear now identifies women's versus men's sizing, labels the size buttons US, and shows official UK/EU/CM-JP conversions plus separate foot length in centimeters. Older Nike USD footwear drafts can infer the guide from their exact source/category/gendered title. Other brands, unidentified gender and non-USD storefronts do not receive a guessed Nike chart. Refundable-reserve help explains internal-balance settlement and approval of a higher amount; layout refinements keep quote amounts, service disclosure and confirmation spacing aligned. Quote arithmetic and saved order fields remain unchanged.

## Catalog-backed orders and store shipping — 30 September 2026

Catalog card links now carry the product ID as context. In that flow, Atlas-owned title, category, boxed weight and store-to-warehouse shipping are read-only for customers; price and selected option can still refresh from the merchant, while a customer-entered link remains editable. The order action and server-side quote recomputation are unchanged.

Operators can set store-to-Atlas shipping in USD and mark it estimated or confirmed. These two fields are optional in stored catalog drafts. Older records continue to show the existing $10 provisional reserve until an operator edits them, and scheduled merchant refreshes preserve the operator's shipping settings.

The cost disclosure groups service, buyout and conversion under “Atlas service,” and international freight plus delivery margin under “International delivery.” This is presentation-only; order fee lines and arithmetic remain separate. The disclosure and its help popover are width-constrained, and link-order selects receive a taller mobile control height.

## Catalog filter hierarchy — 29 September 2026

The catalog keeps search, quick category chips and sorting visible while presenting country and delivered-budget controls in a compact, anchored filter panel. The panel shows a count only when one or more of its filters are active; selected country/budget values remain visible as removable chips with individual clear actions. The existing filter and delivered-cost sorting logic is unchanged, and the layout supports narrow screens and graphite theme without catalog/API/D1 changes.

## Nike color galleries and grouped service display — 29 September 2026

The Nike adapter now matches the exact article in either a PDP URL string or the merchant's object-shaped `pdpUrl.url`/`pdpUrl.path`. A matched product group keeps every sibling colorway, its sizes, price and safe gallery for catalog drafts; the customer order-by-link view is scoped to the exact linked article/color. Each gallery uses one preferred square rendition per source slot, avoiding duplicate portrait/square thumbnails. These fields remain optional import-response/session-draft data; no catalog, cart or order schema changed.

Cart and order-by-link cost summaries show the existing service, buyout, conversion, international freight and delivery-margin components as one “Сервис Atlas” amount. “Состав сервиса” keeps the separate quote rows available on demand. Store delivery, the refundable reserve and general Atlas fee remain distinct, and the quote formula and saved snapshots are unchanged.

## Colorway clarity, refund cases, and local speed diagnostics — 29 September 2026

When a store exposes one unique colorway with a slash-separated descriptive name, link ordering now shows a concise, non-clickable primary color and explains that another color requires its own merchant URL. The original merchant wording remains available on demand; it is not split into false selectable colors. Exact Nike sibling colorways remain in catalog-import data with their own size/price/image metadata; a customer ordering one article sees only that article's color.

The operator can keep an issue/refund case on an order, including a cancelled order: reason, case status, proposed UZS refund amount and a bounded history. An amount is a review note only; no payment, ledger, balance or refund state changes. Internal notes and targeted in-app customer notifications remain separate. Email/SMS are not sent by that notification control.

The admin system tab includes a browser-local performance summary for TTFB, FCP, LCP, INP, CLS and same-origin API latency. The probe retains at most 20 recent samples in that browser's `localStorage`; it does not upload routes, identifiers, request URLs or response data. Public catalog/customs/legal routes have explicit canonical metadata; private/order-entry routes are marked non-indexable, and robots.txt excludes those routes from crawling.

## Nike size options and operator order contacts — 29 September 2026

Nike link imports keep the exact URL-selected style and read sibling colorways only from the same Nike product group for catalog review. Each size retains its colorway's own article/GTIN, price, availability signal and image; other product groups and recommendations are excluded. Customer order-by-link remains scoped to the linked article/color. A Nike `www.nike.com` USD men's shoe page is labelled as Nike US men's sizing and links to Nike's official conversion chart, with a note that the package CM label is not foot length. Other merchants keep their source-provided size label.

The operator order queue can be refreshed manually and searched by order/product, purchaser name, account email, profile phone, recipient name, recipient phone or city. Expanded orders show purchaser-account details separately from the order's delivery recipient. Email and phone are explicit `mailto:`/`tel:` links; the profile phone is labelled unverified and is not confused with the recipient phone. No message is sent by loading or searching the queue. Customer orders place the store-shipping reserve note beside the payment status and explicitly describe it as part of the preliminary total, not a payment record. The catalog eyebrow “КАТАЛОГ ATLAS” (localized for UZ/EN) is restored above the feed title, including on narrow screens.

Link-order gallery thumbnails use `next/image` with optimization disabled because safe merchant image hosts are intentionally variable. Removed three obsolete lint suppressions without changing locale-state behavior. Lint now completes without warnings. The local full API/UI smoke remains constrained by the absent local D1 `market_settings` table; the database was not seeded or otherwise changed.

## Catalog importer recovery — 27 September 2026

Operator imports now preserve a recoverable draft when a supported merchant blocks the public request or returns an expected manual-entry fallback. Safe partial title/image data may be retained, but unverified price, currency and variant availability are cleared. The catalog editor exposes variant name, color, size, price and an explicit operator availability choice; drafts cannot be published until required product data and at least one confirmed available variant are present. Rechecking an existing source that is temporarily unavailable preserves its saved card fields instead of replacing them with empty data. This is a manual-review path, not evidence that the merchant has stock or that the catalog is launch-ready.

## Catalog contrast and centralized operator tariffs — 27 September 2026

The final dark-only catalog layer now overrides the remaining hard-coded navy price, merchant-link and detail-summary text, and gives savings badges, deal labels and count chips contrast-safe graphite-theme colors. Light appearance and catalog behavior are unchanged.

The operator `/admin` workspace now owns a single “Tariffs and services” section for global FX and freight, service/buyout/conversion fees, delivery margin and reserve, general per-line fees, actual-dispatch-country overrides, currency rates and warehouse-service offers. The duplicate editor was removed from `/operations`; that route remains the cross-customer order queue. Settings use the existing operator-protected `/api/operations` API and versioned D1 pricing record; no migration was added. RU/UZ/EN labels and country names are provided. Existing submitted order snapshots remain unchanged. Values are explicitly marked as pre-release estimates, not live carrier, warehouse, FX or payment-provider prices; insurance remains locked and warehouse work still requires feasibility confirmation plus the customer's exact-price approval.

Admin navigation remains conditional on the server-derived operator identity. The existing route gate denies non-operators before mounting admin content, and `/api/operations` checks the configured primary operator before returning or changing data. No customer role or team-directory entry gains admin rights from this UI work. A local browser screenshot pass could not be completed in the available browser harness; source checks and project test/build commands are recorded at handoff.

## Dark appearance and theme preference — 27 September 2026

The shared header has a localized light/dark control on public, customer and operator routes. New visits default to the white/light theme regardless of device appearance; a manual choice is stored only in the browser-local `atlas-theme` preference and follows full-page navigation. Theme state does not enter account, cart, order or API data. Dark mode uses low-glare graphite surfaces, softened text contrast and restrained Atlas blue/lime accents instead of pure black or a green cast. The `next-themes` bootstrap suppresses the root hydration warning and applies the selected `data-theme` before the interface settles.

Catalog cards retain a contained surface and rounded image crop across themes. Product titles and prices may wrap inside narrow cards without widening the grid; catalog search fields, filters and result controls use the same graphite contrast in dark mode.

## Interface review pass — 27 September 2026

## Interface review pass — 27 September 2026

The current review layer applies a green merchant-service palette through the final shared experience stylesheet, without changing the established route or business-action structure. Dark appearance defaults to graphite and is selected manually; the light appearance remains the default. Cart users see a compact fixed total/checkout action on narrow screens; it follows the same customs-consent gate and existing simulated checkout action. Order identifiers can be copied from the expanded order details with a localized accessible control. Shared loading surfaces use a restrained shimmer; actionable order states receive a subtle attention pulse. Motion respects reduced-motion preferences. The order/cart, account, and service flows remain simulated where noted below; visual polish does not imply live payment or fulfilment.

The account's high-priority next-action panel explicitly retains its dark ink surface above generic white `.surface` styling, keeping its white heading and supporting copy readable in the current green review palette.

This is a reviewable visual override, not yet the settled Atlas brand palette. The owner should confirm or ask to revert the green palette before further design-system consolidation. No global test suite was run for this visual iteration; production build is the deployment check.

The customer account no longer displays the legacy browser-data migration panel. The server-side `import-legacy` action was removed on 5 October 2026: it let a customer write their own balance and orders.

## Import recovery and API error localization — 26 September 2026

Adidas product/article JSON failures caused by rate limits, challenges, or malformed payloads now produce a recoverable manual-entry response instead of an unhelpful hard parser error. A customer can confirm the editable price/currency/option and add the item when the merchant is unavailable; whenever the source responds, cart-add and checkout still reject a mismatched price or currency. Availability is not an order gate and is not promised. Exact product/article matching and importer protections remain unchanged. Amazon US location setup still requires the address endpoint to confirm country `US` and ZIP `19701`; the importer no longer searches the refreshed page HTML for a ZIP string after that authoritative confirmation.

API failure responses now resolve display language from the validated `atlas-language` preference cookie, then `Accept-Language`, and return concise RU/UZ/EN messages by status. The browser writes its selected language (or the existing Russian default) before initial API requests. Authentication, roles, state shapes and status codes are unchanged. Russian retains its detailed server messages; UZ/EN currently receive safe localized status-level text. Older operator/catalog history and other legacy UI/legal strings are still not fully localized.

## Cart completion and dispatch-country pricing — 25 September 2026

Successful product additions from the catalog, link-order form and batch link import now take the customer directly to `/cart`. Checkout creates the existing pre-release order records and then offers the existing `payment-demo` confirmation from the cart success dialog. A user must explicitly confirm; this only marks a simulated test payment, does not charge funds, and does not create a shipment. Existing pending orders can still be managed in Orders; real payment-provider integration is not enabled.

Operator-managed pricing supports optional per-dispatch-country overrides for the existing service commission, buyout commission, conversion commission, delivery margin, international per-kg rate, delivery reserve and flat optional-service amount. Country keys are exact existing `Product.country` labels (actual dispatch country), not customer destination. Blank fields inherit the central tariff. Cart/add, quantity changes and quote renewal reprice server-side; existing order quote snapshots stay immutable. These values remain managed/pre-release estimate data, not live commercial rates. The editor was consolidated under `/admin` and its controls are localized in RU/UZ/EN; see the 27 September entry above.

## Warehouse service catalogue and customer approval — 25 September 2026

The operator-managed warehouse service catalogue is stored inside the existing versioned `market_settings.pricing` JSON; no D1 migration is required. It was formerly edited under `/operations`; its central editor now lives under `/admin`. The starter catalogue covers package/content photos, inspection, consolidation, repacking, split parcels, extra packing, fragile handling, priority processing, removing external price tags, special requests, storage extensions, merchant returns and disposal. Admins can localize names/descriptions in RU/UZ/EN, enable/deactivate an offer, choose checkout vs. warehouse request stage, unit, fixed vs. operator-quoted pricing, base UZS amount and per-dispatch-country overrides. Existing order snapshots are not rewritten when settings change. Starter prices are zero/operator quote placeholders, not Shipito or Atlas commercial rates. Insurance remains disabled and server-blocked until an actual insurer, coverage terms, exclusions and claims process are confirmed.

Customers can flag checkout-stage services in `/cart`; this saves a request on the order but does not add a fee, authorize work, or guarantee availability. After warehouse intake is recorded and before weighing, the customer can request configured warehouse-stage services, including a quantity for photo/day/half-hour units. The operator checks feasibility and either marks an unavailable service with a reason or submits a price through the existing change-request handshake. Fixed fees are recomputed from the server-owned service snapshot and dispatch-country rate; quoted services use the operator amount. The customer must approve or decline that exact amount, then an operator can mark the request complete. Unresolved service requests block warehouse weighing so repacking/splitting cannot bypass freight recalculation. Approved adjustments remain separate from the immutable original quote.

This is a workflow preview only: service performance, warehouse/carrier connectivity and real payments are not connected. “Completed” is an internal simulated status, not evidence of physical work. No checkout checkbox silently buys a delayed service. The catalogue follows common forwarding-service categories documented by [Shipito's service FAQ](https://www.shipito.com/en/help/faq/services) and [pricing page](https://www.shipito.com/en/shipito-pricing); Atlas does not copy Shipito's fees or claim its service capabilities.

## Cart warehouse-service UX and intake gates — 26 September 2026

The cart now shows fixed warehouse-service rates per unit and country, supports a customer-selected count for photo/day/half-hour units, and keeps those amounts separate from the current checkout total. Any work still requires an operator feasibility check and exact customer approval; the server snapshots the selected count and rate, validates the cart signature, and retains old-cart compatibility through optional fields. Special warehouse requests require a bounded customer note that is saved for the operator. The admin summary reflects the selected dispatch country's effective service rate. The legacy `optionalServices` setting remains a separate general fee applied to each product line and is labelled separately from requested warehouse services.

Internal inspection tags are now presented as intake notes, not proof that a customer-requested paid service was completed. If the warehouse reports damaged or mismatched goods, weighing remains blocked until the customer explicitly approves a post-inspection proposed substitution marked as resolving that issue; an unrelated approved warehouse fee cannot clear the block. Catalog cards no longer show the dated observation badge or a duplicate store badge; merchant links, dispatch country, and automatic freshness/availability controls remain intact.

## Design direction review — 23 September 2026

## Multiple recipients and passport association — 24 September 2026

The customer profile no longer offers a personal-data download/export. The document centre points to passport records and declaration previews; invoices and warehouse files remain inside their orders. Customers may keep multiple delivery recipients and confirm a separate passport scan for each saved recipient. Passport identity is stored as masked identity data in the owner-scoped account state; the scan itself remains private R2 data, and the D1 confirmation record contains only the masked confirmation snapshot.

Checkout presents saved recipients as selectable cards. Selecting one uses the server-owned saved address and, when available, the identity confirmed for that same recipient. New or edited checkout addresses remain manual and do not borrow another recipient's passport. Orders snapshot the selected recipient ID, delivery details and optional masked identity at checkout, so future profile edits do not rewrite existing orders. Declaration previews use the order's saved recipient snapshot; mixed-recipient orders must be prepared as separate declarations. This remains a simulated internal preview and does not submit documents to customs. New state/order fields are optional and old singleton identity/order snapshots continue to parse.

An isolated review package in `design/` compares Commerce, Editorial and Atlas refined on catalog/product/checkout/account screens in RU/UZ/EN. Start `node design/serve.mjs` for localhost:4318. It uses synthetic prices/state and existing project images; it does not call production APIs or alter tariffs or D1. On 24 September the owner selected A / Commerce. The first production visual pass now uses shared type/spacing tokens in `app/atlas-design.css` and Commerce route-family styling in the existing `app/experience.css`: white shell, flat catalog cards, calmer prices, forms and account next action. No product logic or persistence changed. See `design/README.md` for audit and remaining migration, and `PILOT_READINESS.md` for externally gated launch prerequisites. These design changes do not enable real commerce.

The follow-up Commerce pass replaces the guest's dark banner with a spacious photo-led introduction, removes the forced 650px mobile admin table width, and replaces native prompt dialogs for support replies and collection creation with accessible forms. The catalog browser audit now selects a category actually present in the current published catalog and waits for cards after sign-out; it passes 148 guest/customer/access checks. The admin forms preserve their existing authenticated APIs and D1 actions.

The guest introduction was then tightened after the owner rejected the unrelated stock sneaker photo and excess empty space. It now shows two distinct-category products from the same published catalog ordering as the feed, with direct product-detail actions and RU/UZ/EN paths to the catalog or link order. When no published product image is available, it shows a text fallback instead of inventing a product photo. The browser design check waits for guest state before capturing the home screen. No product, quote or persistence semantics changed.

Account action buttons in document and profile sections now use a responsive grid, can wrap translated labels, and fill their cells without overlapping when an account panel narrows. This is presentation-only; account actions and data remain unchanged.

The final legacy-data disclosure now has a clear vertical gap after the documents/support row so adjacent account sections do not visually run together.

On the catalog home, the order/data-responsibility panel is always rendered as a visible trust callout instead of a collapsed disclosure. Its copy and legal destination are unchanged.

The home FAQ now shows every short answer immediately in a responsive grid. The purchase path is condensed to choose an item, enter a recipient address, and confirm the order, with a clear note that payments and deliveries are still in test mode and no real charges or shipments occur.

An operator-mode local browser pass covered nine admin tabs at 1440/800/390/360px in addition to the main customer routes. It exposed a 390/360px header overflow from the operator link's stronger selector; the mobile header now hides that duplicate link (admin remains in navigation) and keeps locale/account/notification/cart controls within 360px. The account next-action text also wraps directly in its source rule. This did not create an operator authorization path.

## Product

Atlas is a functional pre-release cross-border shopping prototype for customers in Uzbekistan. The intended commercial model is purchasing intermediary plus logistics agent, not the foreign seller or manufacturer. A user chooses a sourced merchant catalog item or pastes a foreign-store product link, receives an editable preliminary UZS calculation, saves a recipient/address, creates a simulated payment and follows the purchase, warehouse, parcel and delivery process.

It is not yet a commercial marketplace: no real payment, purchase, carrier booking, customs filing, money transfer or delivery takes place.

Published URL: https://atlas-uz-market.ishakovzakir0.chatgpt.site  
Handoff baseline: the current operational database, importer and editorial-catalog release (publish result recorded after deployment).
Validation baseline: lint, 47 tests, TypeScript, production build, authenticated API smoke with staff/audit/catalog coverage and the desktop/tablet/mobile browser audit all pass.

## Customer flow

### September 15 UX refinement

Catalog filters and secondary explanatory content now use progressive disclosure. Guest navigation stays public-only, while authenticated accounts expose their own purchases and the administrator alone sees management navigation. Orders use expandable summaries and notification deep links. Checkout separates delivery entry from an explicit review step. Account settings, supporting documents and legal sections are compact, with consent anchors opening the relevant text. Catalog administration adds search, status filters and incremental display without changing D1 schemas or pricing rules.

The account home now calculates a single customer-facing next action from pending approvals, payment, passport, recipient/address and active-order state. It also exposes four compact counters and six primary service shortcuts. This is derived from existing authenticated D1 account state; no client-only account data or new persistence schema was introduced.

Account secondary sections use a controlled single-open accordion, so expanding recipients cannot expand or stretch the customs panel beside it. The account visual language was reduced to fewer containers, quieter borders and one consistent hierarchy instead of repeated card/eyebrow/title combinations.

This is a UX refinement, not a commercial launch or a new authentication system. Complete RU/UZ/EN coverage, live payment/carrier/email integrations and scheduled catalog alerts remain separate work.

1. Open catalog or Заказ по ссылке.
2. Paste a public supported-store product URL.
3. The server imports available title, photo, brand, price, currency, source country, category, declaration draft, variants and weight.
4. Customer checks/edits the source data, selects size/colour/model and adds to cart.
5. For a party, customer can paste up to ten product links at once. Each imported position remains subject to the same verification before checkout.
6. If store shipping is unavailable, the form starts with editable $10 reserve.
7. Customer accepts customs conditions, enters the recipient/address and completes pre-release checkout. One cart line becomes one order.
7a. Customer may note checkout-stage warehouse preferences in the cart; after warehouse intake they may request other configured services. Operator quotes feasibility/cost and the customer must explicitly approve before the simulated completion state.
7. Customer can upload a passport scan to private object storage, check/edit browser-detected MRZ fields and explicitly confirm identity data.
8. Confirmed identity, saved address and selected order lines form a test declaration package. It stays inside Atlas and is not transmitted to customs.
9. Customer confirms a safe simulated payment-provider result; no charge occurs.
10. Operator assigns a team and priority, adds internal notes, confirms merchant shipping, purchase, parcel/tracking, warehouse receipt, settlement and dispatch status.
11. Refunds appear as demo balance credit; extras require approval before the order proceeds.

## Current routes

| Route | Function |
| --- | --- |
| / | Unified product catalog, favourites, filters and quick link entry |
| /order-by-link | Import product and create quote |
| /cart | Cart, optional warehouse-service preferences, balance use, customs consent, simulated checkout |
| /orders | Customer orders, photo refresh and extra approvals |
| /operations | Cross-customer operator order queue and warehouse-service processing |
| /notifications | In-app status, refund and approval notifications |
| /analytics | Operator metrics and closed-pilot readiness |
| /legal | Pre-release terms, privacy, refunds and restricted-goods drafts |
| /account | Profile, delivery recipients with passport status, document centre, monthly purchase indicator and support requests |
| /balance | Demo ledger/balance |
| /favorites | Saved catalog items |
| /customs | Customs guidance and consent |
| /identity | Private passport upload, MRZ assistance and customer confirmation |
| /declaration | Test declaration package from confirmed identity, address and orders |
| /batch-import | Import up to ten product links into one cart party |
| /admin | Operator-only catalog publishing, collections, limits, access controls, audit, system tools and unified global/country pricing plus warehouse-service settings |

## Roles and authentication

The public catalog, customs guide and legal terms are available to guests. Saved finds, import, cart, orders, balance, messages, account, passport and declarations require Atlas sign-in (Telegram, phone code, email code, Google, Apple; lib/auth/). Email, Google and Apple map to the account identity email:<lowercase email>, which also keeps accounts created under the former ChatGPT sign-in. lib/market/server.ts migrates an old platform-ID row into the email-based account; do not reverse this without a migration.

An operator is an authenticated customer whose email matches secret ATLAS_OPERATOR_EMAIL. Client UI is not authorization: operator checks occur in server actions. There are no passwords: every method signs in with a one-time code or a provider (see AUTH_SETUP.md). The public site access policy does not grant operator rights.

## Business logic and price calculation

Default pricing lives in lib/market/domain.ts and lib/market/world.ts. The operator can replace it with a centrally managed version; new and renewed quotes use the current version while submitted orders keep their original values:

| Item | Current demo rule |
| --- | --- |
| UZS per USD | CBU rate × 1.012 (`fxSource: "cbu"`), or an explicitly labelled set rate |
| Atlas fee | 9.98% of merchandise only |
| International freight | express $15.98 / kg, standard $13.98 / kg (`Pricing.perKgUsd`, `standardPerKgUsd`), converted at the Atlas rate |
| International reserve | none since 5 October 2026 (was 20% of international freight) |
| Dimensional divisor | 5,000 |
| Shipping mass | boxed kg of the parcel + 0.3 kg once, at least 1 kg |

Quote is merchandise + merchant-to-warehouse shipping + service fee + international freight + international reserve. Source shipping is per unit and quantity currently multiplies it conservatively.

Supported source currencies: USD, EUR, GBP, RON, CNY, TRY, JPY, KRW, AED, CAD and AUD. Their USD rates, USD/UZS, freight, service, reserve and dimensional divisor are operator-managed. Values remain demo/managed data until a verified market feed is connected.

## Shipping, balance and recalculation

Unknown store shipping uses editable $10 and sourceShippingEstimated true. Since 4 October 2026 the reserve is taken once per store order (lines with the same store host and dispatch country; `storeShippingReserves` in `lib/market/domain.ts`, split across them by merchandise) and not at all from `pricing.storeShippingFreeFromUsd` ($50 by default, editable in the tariff form) of items from that store, because stores usually ship such orders free. The cart tells the customer how much more from that store removes the reserve; a waived reserve shows as "no reserve", never "free". Removing a cart line reprices the rest. Before an order with estimated store shipping leaves status Ожидает выкупа (reserved or waived), an operator enters actual total merchant shipping in USD:

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
- Validation: 49 automated tests, TypeScript, lint and production build passed; 136 browser checks include a real Steve Madden import, loaded gallery images, color/size selection and 390 px rendering. The narrow-screen check also protects the hidden variant field from stretching the page.

## Regional store expansion — 13 September 2026

- The explicit importer allowlist now covers more than 200 storefront roots. The new focus is Spanish fashion, beauty, sneakers and electronics, broader European regional storefronts, and major US department, outlet, beauty, footwear and electronics stores.
- The customer store directory highlights three practical groups — Spain, Europe and US — and explains that the cheapest region depends on the exact product, tax-inclusive storefront price, promotion, size availability and merchant-to-warehouse shipping.
- Enhanced public Shopify import routes were added for stores including FOOTDISTRICT, NAKED Copenhagen, Nude Project, PDPAOLA, Scalpers, Blue Banana, 3INA, Saigu, Represent, Tower 28, MERIT, Good American, Kosas and Faherty. These imports retain photos, price, currency and the available option matrix when the merchant publishes them.
- Enhanced storefront requests pin a public country context so server location does not silently change USD/EUR pricing. The exact customer URL remains authoritative; Atlas never substitutes a supposedly cheaper country automatically.

## Amazon US location verification — 20 September 2026

- `amazon.com` imports and catalog rechecks now create a short-lived anonymous Amazon session, set USD/English storefront preferences, submit the public delivery-location action for United States ZIP `19701` (Bear, Delaware), and only then parse price, availability and images.
- No Amazon account login or customer cookies are used or persisted. If Amazon does not confirm the US ZIP, Atlas stops with a manual-check message instead of silently using an Uzbekistan-IP delivery context.
- The Amazon parser reads the post-location `corePrice` block and merchant image so the US price can enter the same protected cart/checkout recheck path as every other source. Other US stores still use their own public URL/adapter rules; add a store-specific location profile only when its public endpoint is verified.
- Amazon's larger client-side page payload is still bounded by a dedicated 6 MB importer ceiling; other public HTML remains capped at 3 MB.
- The authenticated link-import endpoint bypasses its generic ten-minute cache for Amazon, forcing the US-location handshake even when an older cached snapshot exists.

## Adidas JSON import — 21 September 2026

- Adidas product HTML can be an Akamai 403 challenge for server-side requests. `adidas.com` link imports now read the bounded public PLP JSON first (so a product JSON 429 still leaves a complete card), then enrich with same-host product JSON, match the URL article code, and retain the current locale price, merchant gallery and available size list. The adapter retries the fixed apex Adidas edge route and never sends credentials.
- The adapter ignores PLP results for another article and filters the service's `hidden` size sentinel. Adidas currently rate-limits Chromium client-hint/XHR headers, so its public JSON requests use a minimal credential-free header set and allow only the fixed `adidas.com` ↔ `www.adidas.com` edge redirect. Structured `Clothing`/`jersey` data maps to the clothing category. If Adidas blocks both JSON routes, Atlas keeps the safe manual-entry path instead of displaying an empty or invented card.

## ASOS product and size import — 23 September 2026

- ASOS product pages publish the product size map and stock/price snapshot in separate public page assignments. The adapter verifies the requested `/prd/<id>` against the embedded product ID, then matches each size to stock by exact variant ID.
- Live check on a US ASOS footwear page returned an exact title, USD 29.99, two photos, eight sizes and one explicitly in-stock option. Results are transient; cart verification still rechecks the selected size.
- ASOS stays on the normal safe HTML fetch path. No account cookies, login or challenge bypass is used.

## Editorial catalog — 12 September 2026

- `/admin` now has an operator-only catalog workspace. An operator can paste up to ten allowlisted product URLs, and Atlas imports the store, title, source price/currency, safe gallery, available variants, category and a conservative editable weight into reviewable drafts.
- A collection/category page can be scanned for up to ten allowlisted product URLs before bulk import. The same redirect, timeout, response-size and URL restrictions as product import remain in force.
- Collections have RU/UZ/EN names, visibility and order. Published products can belong to several collections; visible collections appear as focused filters on the home feed, including clothing, cosmetics, brand and seasonal selections.
- Draft and published snapshots are separate. Editing a draft never silently changes the home page; publish copies a reviewed snapshot, hide removes it from the public feed without deleting the draft, and stale/sold-out/incomplete drafts cannot be published.
- Catalog state is stored as versioned JSON in the existing D1 `market_settings` table with optimistic revision checks and operator audit events. The public endpoint returns only current published snapshots and falls back to the bundled catalog if D1 is temporarily unavailable.
- A successful authenticated link order also creates a matching operator-reviewable draft when its canonical source URL is not already present. The draft carries the verified title, source price/currency, country, safe photos, available option matrix and weight; it is marked as a customer-demand signal and is never published automatically. A later request for the same canonical source is idempotent.

## Link-order language and draft continuity — 21 September 2026

- The link-order form keeps its current product, selected option, price, country, currency, shipping, weight, photos, verification and source freshness in a short-lived browser session draft. Switching RU/UZ/EN or remounting the route no longer clears imported or customer-edited values; the server compares the source before cart addition when it returns public data.

## Unified merchant catalog — 13 September 2026

- The former separate deal shelf was removed. Its 13 dated merchant observations now appear as ordinary products inside the main catalog and participate in the same search, category, country, budget, sorting and favourites flow.
- Every card uses a real merchant product photo and opens the exact product page at Merrell, Brooks, Nike, Amazon, Target, Samsung or Walmart. No deal-aggregator page appears in the customer journey.
- Cards expose the store price, comparison discount and a compact preliminary delivered total computed with the current managed pricing, a conservative chargeable-weight estimate and the standard $10 unknown merchant-shipping reserve.
- Products with a recorded comparison discount of at least 40% receive a compact localized “Top price” badge. The percentage remains tied only to the exact merchant listing and recorded comparison price.
- Each card has a direct merchant link and a separate cart action. That protected action requires sign-in, opens the exact merchant URL in the existing link-order flow, automatically imports the current price, photo and available colour/size/model matrix, then adds the customer-confirmed combination directly to the cart.
- The cart write still reimports and verifies returned merchant price/currency/option data on the server; a customer-confirmed manual fallback is available only when the public source is blocked or incomplete. Availability is not a customer-order gate.
- Direct deal navigation also carries a server-bundled editorial fallback for the known title, price, photo, category, conservative weight and applicable size choices. Incomplete or blocked merchant responses no longer erase those fields; successfully imported live variants replace the fallback choices.
- These observations are not Atlas inventory or checkout-ready catalog records. The protected Atlas import flow refreshes price and options when the merchant responds; if it does not, the customer must confirm the displayed price, currency and option. Stock is never guaranteed.

## Unified option matrix — 12 September 2026

- Catalog publishing, customer link import and batch import use the same protected `fetchProduct` pipeline. A catalog click opens link order and refreshes the source instead of trusting the editorial snapshot for price or stock.
- Imported options retain available and unavailable combinations. Link order selects color first and then shows only that color's sizes, with combination-specific price, photo and stock state; unavailable choices stay visible but disabled.
- ProductGroup extraction retains the complete parent variant matrix while deriving the displayed base price from the exact color/variant URL. A recommended color cannot silently change the quote.
- A dedicated Anker `__NEXT_DATA__` adapter retains choice, pack size, price, availability and safe images. Gymshark JSON-LD sizes are enriched with the active page color. Both retain the generic safe fallback.

## Customer-facing language cleanup — 12 September 2026

- Customer screens no longer label the balance, declaration packages, order history, checkout or analytics with internal “demo/test” wording. They use product terms such as “Баланс Atlas”, “Пакет декларации”, “Оплата” and “Оборот”.
- Required truth-in-commerce notices remain: preliminary quotes can change, customs makes the final decision, and payment/carrier integrations must be connected before real money or shipment events are claimed.

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
- Pre-release legal/privacy/refund/restricted-goods drafts.
- Authenticated API smoke test covers checkout through delivered status.

## Pre-release service experience

- Atlas has a shared blue/navy/lime design system, a link-first home screen with an interactive catalog example, responsive four-step journey, and consistent account/forms/order styling. Existing images, navigation and server actions are retained.
- The home and favourites use one unified catalog with search, category/country filters, a delivered-cost budget, percentage/total sorting, saved items, and expandable quote breakdowns. Link entry remains below the feed. Catalog controls and descriptions support RU/UZ/EN; legacy sections and the product sheet retain their existing translations.
- The public feed now uses five sourced US listings in lib/market/catalog.ts: Nike Gato LV8, Cortez Leather, Club Hoodie, Anker Nano 30W and Apple AirTag 1-pack. Official product photos were checked for successful image responses. Prices are dated snapshots, not a live inventory feed. Only Gato and Cortez have reference prices taken from the merchant page. Other items have no fabricated discount. UNIQLO candidates were excluded because fresh pricing could not be confirmed.
- Old demonstration products remain in domain.ts for legacy state/test compatibility but are no longer offered by the feed. Old orders and stored favourite IDs are not rewritten.
- A catalog item opens a seeded link-order calculation with an unconfirmed variant, estimated weight and $10 merchant-shipping reserve. Customer verification is still required. Catalog snapshots cannot be directly added to cart while shippingKnown is false. The product sheet routes catalog items to this confirmation flow.
- ProductGroup JSON-LD import now selects children matching the exact source listing URL, including Nike color-specific sizes, prices and known unavailability; it does not assume all displayed sizes are in stock.
- Repeated demo/presentation wording was removed from the home, header, footer, sign-in introduction and metadata. Real payment/shipment limitations remain explicit at checkout and in legal/financial views. The underlying external services were not activated.

- The home screen explains the path from a store link to a preliminary calculation, confirmation and status tracking. It also includes a supported-store preview, FAQ and clear pre-release/trust notices.
- A profile can store several recipient addresses. The chosen primary recipient remains compatible with checkout and declarations. Customer support requests are retained in that customer's account state; staff response workflow still needs an operational queue.
- Checkout now lets the customer choose a saved recipient or switch to a fresh address, and support requests show their complete message history with customer replies.
- The document centre links to passport confirmation and declaration previews and explains that invoices/warehouse files are attached to orders. Passport source files remain private; customers no longer see a profile export/download action.
- The monthly total is an informational sum of Atlas test orders, not a customs calculation or an official limit balance.

## Partial or missing

- Store parser quality varies; detailed Zara and 20 explicitly verified Shopify storefront adapters complement generic ProductGroup/JSON-LD extraction.
- Store shipping is frequently destination/session-dependent; $10 is reserve only.
- Operations supports one configured operator email. Team assignment and notes work, but independent staff identities and permission roles are not connected.
- Catalog publishing is now database-managed, but imports are still dated merchant observations rather than guaranteed live inventory. Scheduled refresh, commercial reuse rights and merchant agreements still require work.
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

## Store and variant expansion — 12 September 2026

- The importer allowlist now contains 147 store roots. Twenty Shopify storefront roots use anonymous public product/cart endpoints for richer price, currency, gallery, availability and option data.
- New rich roots cover clothing (Alo Yoga), beauty (Rare Beauty, Rhode, Glossier, Summer Fridays, Fenty Beauty), sneakers (Kith, CNCPTS, Sneakersnstuff) and electronics/accessories (Satechi and Spigen). Both Satechi domains resolve to its canonical public storefront endpoint.
- Kith public requests pin the US storefront country so product cents and cart currency are consistently USD instead of an IP-localized unsupported currency. The importer still validates every redirect and never sends customer cookies or credentials.
- Each rich storefront has an explicit category profile. Ambiguous names such as “the rhode kit” and model-only sneaker titles no longer fall into an unrelated category.
- Shopify options now preserve one colour/shade axis plus a combined second axis such as `Size`, `Device / Finish` or another store-provided option label. Price, image and stock remain attached to the exact combination, and old variants without the optional label remain compatible.
- Live product checks succeeded for representative Alo Yoga, Rhode, Rare Beauty, Summer Fridays, Kith, CNCPTS, Satechi and Spigen pages. A successful import remains editable assistance, not a stock, shipping or customs guarantee.
- Verification for this expansion: lint, 51 domain/security tests, TypeScript and the production build passed.

## Store freshness controls — 12 September 2026

- Products imported from a store are fetched again by the authenticated server before `cart-add`. The server matches the stored public variant ID when available, rejects missing or sold-out variants, rejects currency changes and requires the exact current variant price. A successful check refreshes the optional source timestamps and selected image before the server recomputes the quote. Since 4 October 2026 the same comparison runs when the customer presses "Check out" (`cart-check`) and again at checkout (skipped for lines checked in the last 2 minutes): a changed store price or stated store delivery is written into the cart line, marked and repriced, and the action is refused with the new total shown, so the customer confirms it before ordering; a quote made under an older tariff version is repriced the same way. Details: `lib/market/cart-check.ts` and the 4 October section of `ARCHITECTURE.md`.
- Checkout repeats the same read-only source verification for every linked cart line. A changed price or unavailable variant blocks checkout with a specific customer-facing reason; no order is created from stale source data.
- Batch import is now review-first. It loads up to ten cards, shows their photos and all available store variants with variant-specific prices, and adds nothing until the customer explicitly selects every variant. The selected public variant ID is retained for server verification.
- The catalog administrator has a change/error queue and can recheck up to ten selected or problematic cards. Rechecks preserve editorial description, collections and reference price, record fetch errors, and surface price, currency, availability-count and sold-out changes for explicit review before republication.
- These additions extend existing optional JSON fields only; no D1 migration or rewrite of old carts, catalog entries or orders is required.
- Verification for this slice: lint, 53 domain/security tests, TypeScript, production build and the authenticated checkout/catalog/operations smoke passed.

## Catalog refresh queue — 19 September 2026

- A product opened for ordering asks the protected importer for a fresh merchant response instead of using its short display cache. Cart addition and checkout independently compare any returned price/currency/option data; a blocked response uses the explicit customer-confirmed fallback described below.
- Published catalog records now carry optional refresh metadata, so old D1 documents remain compatible. The due queue targets one source observation per card every 24 hours and takes at most five products from different merchant hosts in one run.
- A successful source response with at least one available option updates the source-controlled public snapshot (price, photo and option matrix) while preserving editorial description, collections and comparison price. A non-empty matrix whose every option is explicitly unavailable unpublishes the card without deleting its draft; a later confirmed recovery can republish it. Timeout, CAPTCHA, incomplete data and an empty option matrix never count as sold out.
- Administrators can run the next bounded batch from Catalog Control. The protected internal refresh endpoint is ready for an external scheduled Worker and uses a short-lived HMAC signature plus a D1 lease. This Sites/Vinext deployment does not yet have a cron trigger wired: until a separate scheduler and `ATLAS_CATALOG_REFRESH_SECRET` are configured, automatic background runs must not be described as active.

## Unified catalog synchronization — 13 September 2026

- Source-controlled merchant additions are now merged into the existing versioned D1 catalog on the server. The merge is additive: operator edits, collection assignments, published snapshots and hidden entries are never overwritten.
- Public catalog, home collections, favourites, link ordering and the administrator catalog workspace now consume the same D1-backed published records. The former client-only deal merge was removed, so operator publish/hide actions control every customer surface.
- Newly bundled records retain their reference price and known size choices. Public catalog snapshots pass available variant labels into link ordering instead of replacing them with a generic placeholder.
- Merrell is now an explicit allowlisted merchant root so its catalog record and protected source recheck follow the same importer security boundary.

## Weight and customer availability checks — 14 September 2026

- Imported merchant weights are accepted only when they resolve to a finite boxed weight through 49.5 kg. Invalid source values such as `99999 kg` are discarded before they can reach a form or quote.
- Category fallbacks are now more conservative, and the bundled catalog's unchanged legacy estimates are upgraded additively in D1. A weight manually changed away from the known old seed value is preserved.
- When a store blocks fresh import for a catalog product, link ordering keeps any saved editorial data visible and does not ask the customer to report stock. After the customer confirms the displayed price, currency and option, the order request can be saved despite the unavailable public response; any returned price/currency mismatch and definite not-found response still block it.
- The authenticated, rate-limited availability-report API remains available for operator/support tooling and old clients, but it is no longer part of the customer link-order flow. Reports flag the draft for operator review without letting a customer hide a public product directly.
- The catalog administrator sees unresolved reports with product, variant, time, merchant link and product shortcut. A successful source recheck or explicit hide resolves the reports.

## Direct-merchant deal picks — 20 September 2026

- The bundled catalog includes six fresh editorial picks selected from the Slickdeals front page: Anker Prime charger, WÜSTHOF knife, HP ProBook Fortis, LEGO City Burger Truck, Logitech K780 Resale and BIRCEN sunglasses.
- Slickdeals is used only for editorial discovery and discount observation. Customer-facing `sourceUrl` values are canonical Amazon/eBay product URLs, and card images come from the merchant image hosts; no Slickdeals redirect or image is exposed in Atlas.
- These are dated observations, not inventory or guarantees. Before cart/checkout the server attempts a protected price/currency/option recheck. If the merchant is unreachable or omits public details, only an explicitly customer-confirmed request can proceed; mismatches and definite not-found responses stop. Customer ordering does not gate on stock status.
- The link-order notice always includes the exact merchant-page link, including successful partial imports. Zero-cost shipping is labelled as merchant delivery to the Atlas warehouse rather than customer delivery.
- Generic imports infer the storefront dispatch country from explicit shipping origin, locale path, regional domain or a bounded merchant map; currency continues to come from the store and falls back from the inferred country only when the page omits it. Category inference also uses structured product category/description and recognizes common trackers such as AirTag.
- International freight now has a one-kilogram minimum per merchant parcel. Cart rows from the same source host and dispatch country combine boxed weight, add the 0.3 kg packaging once (the former 0.2 kg allowance was removed on 5 October 2026), and allocate the resulting freight and reserve across their immutable line quotes.

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

## Globbing B2B operating model — 23 September 2026

- The founder's working commercial assumption is that Atlas centrally arranges personal-use purchases for named individual customers; customers would not register or operate Globbing accounts. This is not yet approved by Globbing and does not change the prototype's simulated payment, purchase, customs or delivery status.
- The public Globbing terms describe user-specific accounts and purchase on behalf/at the expense of each user. Do not infer that Atlas may use a single personal account or centrally place third-party orders. Obtain written confirmation and a corporate contract/process before real transactions.
- Role mapping (foreign-store buyer, Atlas customer/principal, Globbing contracting party, consignee, declarant/customs representative) remains unresolved pending written carrier terms and Uzbekistan counsel review. See `GLOBBING_B2B_PLAYBOOK.md` for the negotiation checklist and go/no-go gate.

## SEO foundation and shared-language cleanup — 19 September 2026

- Root metadata now has a production title template, honest preliminary-quote description, canonical URL, Open Graph and X card fields, locale hints and crawler directives. The internal development-only preview metadata was removed.
- Public indexing is explicit: `public/robots.txt` allows the catalog, customs guidance and legal page, blocks authenticated/API/operator routes, and points to `public/sitemap.xml` with the three public URLs.
- Shared breadcrumb, footer, mobile saved-items label, retry action and sign-in link now use the existing RU/UZ/EN shell dictionary instead of hardcoded Russian strings. Product names and merchant content remain source-controlled and are not machine-translated.
- Verification for this slice: targeted ESLint, 64 domain/security tests and production build passed. Full-project lint via the unavailable npm launcher was not used; the installed project ESLint binary passed on changed files.
- ChatGPT discovery is opt-in at the public-content boundary: `OAI-SearchBot` and `GPTBot` may crawl public pages, while private/API/operator paths remain blocked. `public/llms.txt` gives AI systems a concise, dated-safe description of Atlas and links only to public pages. Placement in ChatGPT Search is not guaranteed.

## Locale persistence and transactional localization — 19 September 2026

- The client language selector now writes a validated `atlas-language` preference immediately, applies it optimistically, and replays it as an authenticated `communication-save` action when the server snapshot still has another locale. This matters because Atlas uses reliable full-page anchor navigation; a pending request must not be lost when the customer opens cart, orders or another route immediately after switching language.
- Account panels use an explicit single-open disclosure controller instead of browser-controlled sibling `<details>` elements. This prevents the address panel from opening the customs panel at the same time and improves keyboard semantics.
- The primary customer journeys now use RU/UZ/EN copy on link order, cart/checkout, batch import, passport, declaration, customs, account, customer orders, balance and notifications. Dynamic link-import messages, merchant names, product titles and source URLs remain source text; operator controls, legal body copy and some server-generated history/messages still require a reviewed translation pass.
- Shared product-image fallbacks and quote-expiry labels accept the active locale. International cart and same-merchant parcel rules remain unchanged.
- Verification for this slice: full-project ESLint, TypeScript, 64 domain/security tests, production build and the 137-check guest/customer/operator desktop/mobile browser audit passed after the transactional copy update. `npm` itself is unavailable in this Windows runtime, so the repository's installed Node entrypoints were used for the equivalent commands.

## Conversion continuity, account clarity and safe release boundary — 20 September 2026

- A guest who pastes a valid product link is now sent to the sign-in flow with the exact `/order-by-link?url=…` return path preserved. Importing remains authenticated; the interface no longer promises a calculation that a guest cannot open.
- The account dashboard gives its single next-action slot to a pending decision, simulated payment, active order, cart or missing recipient in that order. Passport confirmation remains a visible service and declaration prerequisite, but is not used as unsolicited first-run pressure.
- The saved-address form now has native autocomplete semantics and bounded, local Uzbekistan region/city/street suggestions. Atlas does not send an address to a third-party search provider for those suggestions.
- Shared catalog-shell, product-sheet and provider fallback messages now follow RU/UZ/EN. Merchant data stays source text; legacy operator, legal and server-authored text still needs a reviewed translation pass.
- Private order-document downloads remain attachment-only and private/no-store, and now explicitly use `X-Content-Type-Options: nosniff`.
- Freshness is intentionally enforced: the local D1 catalog state examined on 20 September contained observations dated 11 September, beyond the seven-day public lifetime, so `/api/catalog` returned no cards rather than showing an old commercial price. Fresh, reviewed merchant snapshots must be imported and published before the public catalog or its end-to-end browser audit can be considered release-ready.
- Verification of this slice: full-project ESLint, 68 Node tests and production build passed. The normal browser audit passed 141 guest/customer/operator checks while explicitly recording that catalog-card checks were skipped because no fresh D1 snapshot was available. Its strict `ATLAS_AUDIT_REQUIRE_CATALOG=1` mode correctly rejects that state with a release-blocking message; no stale timestamp was changed to make the check pass.

## Priority merchant contract and stock safety — 22 September 2026

- `lib/importer/merchant-profiles.ts` keeps an explicit, reviewable priority registry for the first US and European rollout: Amazon, Nike, adidas, Macy's, eBay, Walmart, Target, Best Buy, Sephora, Foot Locker, Zalando, ASOS, Zara, Mango, Farfetch, Primor, Druni, MediaMarkt, PcComponentes and Decathlon.
- Profiles only fill missing merchant/category/dispatch metadata. They never invent price, shipping, photos, SKU, variants or stock and never substitute a cheaper regional URL. The customer URL remains authoritative.
- Generic JSON-LD/ProductGroup imports select the exact linked listing instead of a recommendation, preserve SKU/GTIN identities where unique, cap matrices at 80 options and reject unsafe or unrelated structured URLs. Adidas responses must match the article code in the URL.
- Merchant option records carry optional `availabilityKnown`. Customer cart/checkout ignores stock signals and tries to compare returned price/currency/option data; when that response is unavailable, the customer-confirmed manual fallback can proceed. The published catalog snapshot remains governed by the separate catalog refresh policy; only an explicit all-sold-out matrix can auto-hide a card. Older stored records remain compatible because the field is optional.
- `scripts/catalog-refresh.mjs` signs the existing HMAC refresh endpoint for an external scheduler. It does not contain a secret; production still needs a separate scheduled Worker and `ATLAS_CATALOG_REFRESH_SECRET`.

## Priority merchant embedded fallback — 22 September 2026

- Priority-1/priority-2 pages that omit JSON-LD can now be read from a bounded public `__NEXT_DATA__`, `__PRELOADED_STATE__`, `__INITIAL_STATE__` or `__APOLLO_STATE__` payload for Macy's, eBay, Walmart, Target, Best Buy, Sephora, Foot Locker, Zalando regional hosts, ASOS, Zara, Mango, Farfetch, Primor, Druni, MediaMarkt, PcComponentes and Decathlon.
- The fallback accepts only a product object tied to the exact source path or product identifier. It ignores recommendation objects, unsafe URLs and short generic numeric ids. It retains only public title, price, currency, photos, SKU, option matrix, explicit availability and bounded weight/shipping fields.
- Unknown stock remains unknown and does not block customer cart/checkout; the admin catalog publication/refresh policy still treats unknown stock conservatively. A blocked page or missing exact embedded record continues to the safe JSON-LD/Open Graph/manual path; Atlas does not bypass CAPTCHA, login, merchant cookies or official API requirements. When a public source does respond, mismatched price/currency blocks; otherwise a customer-confirmed manual order request may proceed. Stock is not promised.
- `workers/catalog-refresh/` now contains a deployable separate Cloudflare Cron Worker and `wrangler.toml.example`. It signs the existing refresh route hourly with Web Crypto, refuses non-HTTPS site URLs and keeps the secret in Wrangler secret storage; production provisioning and matching runtime secrets remain a deployment task.

## GitLab Ultimate CI preparation — 26 September 2026

- Added `.gitlab-ci.yml` for Node 22 installation, lint, domain/security tests and production build, with GitLab-managed Dependency Scanning v2, SAST/Advanced SAST and pipeline Secret Detection.
- The pipeline does not deploy the site or access production secrets, D1 or passport data. GitHub remains the canonical repository for Jules; GitLab is intended as a one-way pull mirror for additional CI/security visibility.
- No GitLab project was selected or authorized during this change. Mirroring, CI execution and Security Dashboard results are not active or verified yet. Pipeline config still needs GitLab's own validation after the GitLab connector is connected.

## Jules PR updates reviewed locally — 26 September 2026

- GitHub PR #2 was already merged into `main`; its Deals Feed tooltip and checkout/payment loading-indicator changes are integrated here. Generated build/server logs and the unrelated `pnpm-lock.yaml` were excluded; `.Jules/palette.md` was retained as a small design reference.
- GitHub PR #1 remains open upstream and is integrated locally for review: the supported-store host set is precomputed without widening the explicit allowlist, Macy's has a guarded public-state parser, Adidas malformed/blocked JSON can fall back to editable entry, Amazon ZIP validation relies on the parsed location response, and server errors carry locale-aware codes.
- The local integration is not pushed. Keep PR #1 open until its owner reviews the combined result. Macy's parser has synthetic fixture coverage; its live `__PRELOADED_STATE__` shape still needs a real-page verification.

## Compact imported-link controls — 26 September 2026

- The redundant “item already selected” banner is removed from imported order links. The merchant link, collapsed import details and change-link action sit in a compact utility row, with RU/UZ/EN labels.
- Automatic merchant recheck, its unresolved/error status and the server-backed gate against adding an unverified item remain unchanged.

## GitHub branch review and selective Site integration — 26 September 2026

- GitHub `main` at `3c06b83` is already an ancestor of the Site checkout. Open PR #1, open PR #3, the already-merged PR #2, PR #4, and the later palette branch were reviewed separately. Do not describe their branch heads as merged wholesale: generated files, lockfile deletion, old palette, misleading cron claims and a staff-authority change were intentionally rejected.
- Sephora's nonstandard `linkJSON` script can now feed the ordinary JSON-LD extractor only for `sephora.com` and the exact listing URL. Unmatched recommendations cannot supply a price; stock absent from the merchant remains unverified. The guarded Macy's, Adidas, Amazon and locale changes already in this checkout remain unchanged.
- The account address panel uses compact cards and a clear add action; cart and saved-recipient removals require a second click. Support fields now have visible labels and server-aligned length limits. The empty-cart action is localized. No order, cart or account schema was changed.
- A dismissible, localized notice describes browser storage and links to the privacy draft. It is informational, not a claim of completed legal cookie consent. The public metadata, robots, sitemap and AI factsheet now use the verified Site origin `atlas-uz-market.ishakovzakir0.chatgpt.site`.
- `workers/catalog-refresh/wrangler.toml` records the intended hourly schedule and current public Site URL as source configuration only. The separate Worker, shared secret and real scheduled calls have **not** been provisioned or verified; Sites deployment alone does not activate them. Payments, shipment, customs filing and notifications remain simulated.

## Customer stock gate removed — 27 September 2026

- Customer link orders no longer use `available` / `availabilityKnown` as an add-to-cart or checkout gate. The manual “open the store and report stock” interaction is removed; catalog refresh/publication still uses its separate operator stock policy.
- When an otherwise valid published catalog observation is older than seven days, the storefront retains its last valid source price/currency for a visibly preliminary delivered-cost estimate using current Atlas pricing. It hides stale discount/reference claims and option-level prices and does not claim current stock. The card links to the order flow for a live price/option check; the stale figure is not a current quote.
- Cart-add and checkout now actually honor the manual-entry route for public HTTPS stores outside the importer allowlist: no server request is made to those stores, the customer must confirm entered details for a new item, and the server still validates URL shape and recomputes the quote. Allowlisted stores continue through live price/currency/option checks; optional legacy cart records remain readable.
- `ManualEntryFallbackError` carries any safe partial data. After the customer confirms the visible price, currency and selected option, cart-add and checkout may proceed if a public store response is unavailable. When the store does respond, the server still checks currency and any published product/selected-option price; mismatches stop the action. A missing option/stock signal does not itself block a buyer-confirmed order.
- The page must not describe a manual fallback as a fresh merchant quote, confirmed inventory or guaranteed buyout. At checkout, the operator still needs to resolve any actual store-side purchase issue with the customer.
- eBay short host `ebay.us` is explicitly allowlisted; redirect destinations remain HTTPS and within the store allowlist. Public eBay embedded data is accepted only when tied to the exact listing. Blocked pages retain title/photo when available and allow explicit manual confirmation; no eBay Browse API credentials are configured.
- `/stores` is a searchable, categorized directory generated from the existing allowlist and is separate from the order-by-link form. Catalog-empty fallback keeps previously reviewed direct links visible while removing expired price/discount claims. Imported image galleries collapse known rendition URLs without merging distinct color/variant URLs.

## Graphite theme contrast pass — 27 September 2026

- Added a final semantic dark-theme layer after the existing stylesheet stack so light-mode fixed surfaces in catalog/search, imported product choices, cart, account, orders, warehouse-service panels and admin/operations are paired with readable graphite backgrounds, text and borders.
- Reworked warning/success/error status pairs, open/selected/disabled controls, active order timeline states, customs estimate details, quantity controls, recipient/passport choices, admin tabs/tables and keyboard focus colors. Light theme, domain behavior, authorization and stored state are unchanged.
- The in-app Browser connection could not initialize during this pass, so responsive visual screenshots and contrast measurement remain a manual follow-up; production build verification is recorded separately.

## iPhone-first mobile foundation — 27 September 2026

- Added a device-width viewport with `viewport-fit=cover`, safe-area-aware shell spacing, 48px/16px mobile form controls to avoid iOS focus zoom, and 44px touch targets for mobile navigation and card actions. The compact cart checkout bar clears the fixed bottom navigation and the iPhone safe area.
- Reduced mobile header duplication so the wordmark, theme switch, language selector and notifications fit without clipping; account and cart remain available from the persistent mobile navigation, while operator access stays available as an icon control.
- Kept the storage/privacy notice dismissible and above the mobile navigation. No cart/order/customer state, fees, access rules or APIs changed.
- The dependency-free browser audit now emulates 360/390/402/430px phone widths and checks viewport-fit, header width, form tap sizing, navigation, cart-bar clearance, and mobile account/cart/link-order screens. Latest run passed 191 checks. These are Chromium device emulations, not physical iPhone Safari verification; keyboard behavior, notch/home-indicator safe areas and dark-theme screenshots still need a real-device pass.

## Operator batch import and product variants — 27 September 2026

- `/admin` keeps the secure single-product `/api/catalog` operation and processes up to 10 unique URLs sequentially per pass. Progress is visible per URL; saved URLs leave the queue, failed and not-yet-processed URLs remain. A revision conflict reloads current D1 state, reconciles a just-saved item, and makes at most one safe retry. Rate-limit responses pause the queue. Imports remain reviewable drafts and are never auto-published.
- Catalog draft review now displays the imported photo gallery and each store option's ID, label, color, size, option price, image and source-reported availability. The bounded 250-option matrix remains in the existing versioned D1 document.
- Public products may now carry optional `sourceVariants` and `sourceImages` alongside legacy `variants` labels and `image`. Old products/orders need no migration. Public output sanitizes image URLs; stale snapshots retain option labels for manual selection but no longer expose old option prices or claim current availability. Customer charges still use server-side merchant verification and pricing, never this display matrix.
- Planned customer domain: `atlasmarket.uz`. It is not connected yet. Until Sites confirms the custom-domain mapping and HTTPS, the active origin and canonical/robots/sitemap/llms URLs remain `atlas-uz-market.ishakovzakir0.chatgpt.site`. Domain cutover must update metadata, sitemap, robots, AI factsheet and refresh worker origin together.

## US priority stores and regional beauty/lingerie import — 2026-09-27

- The explicit priority-1 registry is a chosen 15-store US-first launch set: Amazon, Nike, adidas, Macy's, eBay, Walmart, Target, Best Buy, Sephora US, Foot Locker US, Victoria's Secret US, Nordstrom, Ulta Beauty, Apple US and New Balance US. This is an operational priority list, not a claim that every product page is guaranteed to parse.
- Exact regional hosts are allowlisted for Sephora Spain (`sephora.es`) and Victoria's Secret Spain (`es.victoriassecret.com`). The latter is a regional subdomain, not `victoriassecret.es`; arbitrary sibling subdomains remain disallowed. Both US and Spain entries appear in the store directory.
- Structured product groups can retain child variants without child-page URLs only when the parent group matches the supplied listing. Variant extraction recognizes named shade/color, size, bra band and cup options; band+cup are carried together, numeric merchant variant IDs are retained only when safely representable, and duplicate IDs are removed. Spanish apparel terms support category inference.
- Sephora's `linkJSON` parser is restricted to the exact approved US/Spain host and exact listing URL; recommendations cannot supply a linked product's price. Product metadata continues to be editable assistance. Missing price, currency, options or images are never fabricated, and customer stock checks remain governed by the existing product/order policy.
- Representative synthetic contract tests cover US/Spain formats and exact-product boundaries. This runtime receives 403/anti-bot responses from the tested Sephora and Victoria's Secret public pages, so those cases are not claimed as live end-to-end verified. Do not bypass merchant challenges; request approved feeds/APIs or retain explicit manual fallback. Live fixtures for all priority stores remain a release follow-up.

## Button and cart response optimization — 27 September 2026

- Account migration/initialization writes are grouped into one D1 batch before the current account is read. This preserves the email-based identity key and old platform-ID migration behavior while removing a sequential round trip when both writes are needed.
- A successful mutation still waits for the canonical revision-checked `market_accounts` write. The rebuildable operator projection is scheduled with Cloudflare `waitUntil`; it reloads the latest saved account revision and rechecks for concurrent changes so an older snapshot does not overwrite newer state. Projection failures remain recoverable through the administrator rebuild.
- After a source-backed link item is saved, its idempotent catalog-review draft is scheduled in the background and no longer delays the cart response. It is still a review draft, never auto-published.
- When a public merchant response is available, its current price, currency and selected-option comparison remains synchronous before the cart write. If the merchant is blocked or omits data, the existing explicit customer-confirmed fallback remains in force; no cached or browser-provided observation becomes authority. Slow merchant pages can still delay a linked item and must not be bypassed.

## Route loading and D1 read optimization — 27 September 2026

- Large non-storefront client views are now loaded on demand via React lazy chunks; their loading state is localized and accessible. This reduces code required when opening the shared marketplace shell without changing route access checks.
- The catalog no longer makes an unconditional request from the global provider. It loads on catalog/favorites pages only and coalesces concurrent requests. Catalog fallback content remains immediately available while the request resolves.
- Reading an already initialized account now performs one D1 select and no write batch. Missing accounts still use the email identity, preserve legacy platform-ID migration, and use `INSERT OR IGNORE` to remain safe under concurrent first visits.
- Account, customer action and operator routes now get pricing and policy through one settings query rather than two. API response fields, policy defaults and tariff validation remain unchanged.
- Build snapshot after this change: route modules are separate assets; the previous single ~563 KiB marketplace chunk is no longer emitted as one file (largest route-shell chunk is ~70 KiB). Shared framework/store/UI chunks and a ~333 KiB global CSS file remain; inspect compressed transfer size and real route waterfalls before further splitting them.

## Copy hierarchy and supported stores — 27 September 2026

- Replaced the duplicated, collapsed “supported stores” callout with one visible localized store strip. It now has only one section heading, shared type scale, compact chips and a single link to the categorized store directory; the link-order action remains in the main shopping entry points.
- Removed the stale profile-export wording from the home trust copy. Aligned the RU/UZ/EN store-directory heading meaning and corrected the Uzbek count label without changing directory contents or importer support claims.
- Applied the Atlas forest accent to Atlas controls while retaining blue for navigation and original merchant links; dark-mode primary buttons and the logo arrow use a softer sage brand accent. Corrected a mobile cascade that hid the operator-only admin icon and overrode flexible admin table columns with narrow fixed widths.
- The in-app Browser runtime rejected the supported setup import (`node:process` is unavailable), so actual font rendering, screenshots and mobile interaction were not verified. Unit tests/build and source inspection do not replace a deployed guest/customer/operator visual pass or physical iPhone Safari.

## Admin catalog queue and importer fallback — 27 September 2026

- Catalog review defaults to newly queued imports; published, previously added/hidden, and all records have separate tabs. Desktop cards display in a five-column grid where width permits and collapse responsively; editors span the full grid width.
- Operators can select all matching results, recheck in bounded groups of ten, hide/unpublish, or confirm deletion of unpublished non-bundled drafts. The API checks operator identity and same-origin, validates IDs/state/revision, and audits affected IDs. Bundled/published items are protected from hard deletion.
- Imports now preserve a reasoned manual-review path for upstream/network/response/redirect/incomplete failures. Incomplete importer data remains explicitly unconfirmed; add-to-cart and checkout continue to require existing server-side exact price/currency/variant validation.
- Price-only variant matrices (notably Shopify product endpoints with no one base price) are retained without averaging or guessing; unpriced variants are called out. XHTML product responses are accepted, and disallowed redirect targets are never followed.
- Automated fixtures are not live merchant verification. Store support remains adapter-specific and some approved sites may require customer/admin manual completion.

## Catalog add-to-cart entry and refresh activation — 27 September 2026

- Catalog product cards use an explicit localized “Add to cart” action instead of “Check price.” For a source-linked product, this opens the existing protected link-order flow, which requests a fresh merchant import on entry; the customer still selects/accepts the current option and the server independently verifies price/currency before persisting the cart line. It does not add a dated catalog price directly.
- The separate hourly Cloudflare Cron Worker remains source-only in `workers/catalog-refresh/`. The Site production settings do not contain `ATLAS_CATALOG_REFRESH_SECRET`, no Wrangler CLI/account authentication is configured on this host, and no deployed trigger has been verified. Therefore background refresh is not active; the source check on customer click remains active. Do not present the hourly schedule as deployed until both secret bindings, the Worker deployment and an observed signed run are verified.

## Order-by-link quote presentation and customs estimate — 29 September 2026

- The link-order quote groups Atlas service, buyout, conversion, international delivery and delivery margin under one expandable service amount. Its international-delivery help text explicitly overrides the no-wrap rule used by quote amounts, and the main quote disclosure styles only its own summary. Server quote components and totals are unchanged.
- The link-order page hides redundant import-status/freshness text, declaration preview and manual photo-URL editor; store link/change, imported image selection, editable product data and saved draft state remain. A sole imported option is selected automatically; restoration supports older drafts without a selected label.
- Customs guidance is removed from the link-order quote and public product cards. The cart shows the informational calculator only when aggregate merchandise exceeds $200; `/customs` retains the detailed calculator. The consolidated PP-4508 text dated 1 September 2026 shows 20% / $2 per kg, while UP-174 separately states 1 January 2027. Customs must confirm the effective date before commercial reliance.
- Planned payment-provider copy has been removed from the public catalog/footer. No crypto provider, payment acceptance, card charge or real shipment was added; simulation and consent safeguards remain in checkout and account/order workflows.

## Catalog and operator workflow polish — 29 September 2026

- Operator catalog review distinguishes new queue, customer-submitted product links, published catalog products, older/hidden records and all records. Rechecking all selected entries now runs sequential server-limited groups of ten; conflict/failure handling preserves unprocessed selection. Link imports accept up to 16 items per launch and preserve the rest for retry.
- When collection selection is empty, imports from a known store inherit its most-used collections. Seasonal/outfit/store/deals starter presets provide RU/UZ/EN collection labels. No translation provider is configured, so arbitrary collection names are not automatically machine-translated; missing locales use the existing fallback.
- Every published storefront card keeps its order CTA and enters the protected fresh-price/variant flow. Draft imports and customer suggestions remain unpublished until operator review; the CTA does not promise stock, merchant support, successful purchase or delivery.
- Catalog refresh, changed-price review and sold-out hiding require the separate signed scheduled Worker. It is not provisioned or verified in production; only manually requested refresh is available. Definitive all-options-unavailable checks can hide a product while retaining its draft; there is no automatic hard deletion.
- Finance summarizes saved quote snapshots and simulated payment workflow states, not collected revenue. The audit tab filters the actual retained admin/system audit events; customer activity is not in this event stream, and only the latest 100 events are returned.
- Pricing editor adds a focused disclosure for per-country overrides and guards unsaved edits. No pricing schema or calculation changed. The product page no longer carries the duplicate catalog overline or customs/payment setup banners; browse filters expose sorting and additional filters more clearly.

## Refund review and targeted customer notices — 29 September 2026

`/operations` has a dedicated refund/cancellation queue for cancelled orders, orders with the simulated `refunded` status, and orders with owner-ledger credits. Each row calculates positive `customer-credit` entries from that order owner's existing account state and labels them as internal Atlas balance accounting. A cancelled order without a recorded balance credit is explicitly shown as such; the queue does not imply a card, bank or wallet transfer.

Operator notes remain internal and are displayed separately from a new targeted in-app notification form. The notification action references an order ID, resolves the target account from the authenticated operator queue, and saves a bounded title/body to that owner's existing notification list. It creates no email/SMS preview or external delivery. The `/api/operations` operator email, same-origin, account revision, action-schema and audit checks remain in force. All fields reuse existing optional state; no migration or rewrite of old orders was added.

The browser UI for this refund/notification pass has not yet been visually verified at mobile/desktop widths; automated project checks are recorded at handoff. Real provider refunds and email/SMS delivery remain unavailable, and all refund/payment states are Atlas-internal simulation.
# eBay parent listing recovery — 1 October 2026

Parent variation listings rejected by the legacy Browse endpoint with HTTP 400 now use the exact listing group endpoint. Explicit child selection is never silently replaced. Exact-parent variants retain individual prices and availability; unrelated group images/currencies are excluded. Regression suite: 188 passing tests. Version 128 live verification on atlasmarket.uz: listing 157740212601 returned seven available variants and seven photos, with selected prices USD 19 and USD 23 for different size/color combinations. No checkout or customer-state writes performed.

# ShopSimon import support — 1 October 2026

Added only the exact `shop.simon.com` storefront to the importer allowlist and US store directory. Its public Shopify product/currency endpoints use the existing anonymous, bounded pipeline; color, Shoe Size, per-variant price/stock and galleries are retained. The NYC proxy allowlist was updated with exactly this one host (no removals), backed up and restarted successfully. Local live checks: Nike toddler Dunk USD 60, four variants/one available/two photos; NVLT crochet jacket USD 229, ten available variants/four photos. Two older adidas URLs returned zero available variants and must not be labelled in stock. Production UI verification is still a release check. No account/cart/order schema or tariff change.


## Cart and order messages, favourites — 7 October 2026

- Each cart/order message now says one thing in one place. Cart: free store delivery is only the bill line (the parcel note is gone); an unknown store delivery is a short status under the parcel ("уточняется, ещё $X — бесплатно"), the hold amount stays in "Не входит в сумму к оплате" without repeating the bill line's help; "Atlas оплатит таможню за меня" when chosen says "Поручение принято…" instead of repeating the fee amount already in the bill.
- Orders: the payment-pending note is said once (the action block); the payment row shows only the status and id while it is pending; the passport banner keeps its action and link without the payment sentence; customs is one note — the settled duty, else the status of the customer's "Atlas pays customs" request (with or without expected duty), else the estimate.
- Favourites: an empty heart means not saved, a filled heart on a green circle means saved; a saved catalog card has a thin green frame and soft green tint (both themes).
- Cart (built on PR #26's option groups): one row of actions per line — quantity, heart (keeps the line), "Отложить" (saves, then removes), a quiet red "Удалить" (icon only below 420 px). Options of one product show the product once (photo, name, store link, total, heart, "Отложить", "Удалить все (N)") and one compact line per option (option · store price, sum, quantity, remove); their note and services are shared (#26). A group of three options on a 393 px phone is about 560 px instead of about 1100.
- Orders: the "Нужно ваше решение: N" banner is gone; the "Нужно решение" tab count turns warning-coloured instead. The passport banner puts its button on the right from 600 px.
- Link order: a cart entry with the unit count sits beside "Добавить в корзину" and in the phone total bar; the count bumps after an add, the existing banner on top confirms it.
