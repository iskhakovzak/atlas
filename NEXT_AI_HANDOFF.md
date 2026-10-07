# Atlas — handoff для следующего AI-агента

## Full eBay group for customer and operator — 8 October 2026

The user requested every in-stock colour/size from a seller group in both customer link ordering and admin catalog import. Official Browse group JSON now has a separate finite 8 MB body budget; OAuth/single-item limits remain unchanged at 32 KB/1 MB. Existing timeouts, exact group identity, 250-variant limit and safe images remain. Unknown-stock, known-unavailable and explicit zero-quantity variants are excluded from selectable eBay groups. Each returned option retains its ID, seller dimensions, price, photo and stock data. An explicit var selects its child by selectedVariantId; customer source-colour filtering exempts exact supported eBay hosts, so sibling colours remain selectable. Other stores retain their colour-bound links. Operator importDraft already preserves the shared group's full variant matrix.

The preceding exact-child fix remains a fail-safe if a group request cannot be read; normal groups are always requested first. The initial 9eb2eaf source/archive was prepared but not saved/deployed; this broader group release replaces it. No migration, pricing formula, secret or real order changes. Tests include >1 MB successful colour/size group, operator draft preservation, customer eBay colour exposure versus Nike/lookalike hosts, unknown/sold-out/zero-quantity exclusion, and an oversized >8 MB fail-safe that never substitutes a parent child. 739 tests pass; complete final lint, TypeScript/build and deployed actual-user-link checks before claiming production success.


## eBay explicit variation / group failure fix — 8 October 2026

User listing 157751149633?var=459304625551 (including affiliate parameters) reproducibly returned HTTP 422 on version 148. Worker diagnostics identify browse_variants/status=200: the complete group response was rejected by bounded JSON reading after the exact child endpoint succeeded. The fix retains the verified child from getItemByLegacyId when group reading fails, mapping only its authoritative identity/price/availability/photos, setting selectedVariantId and keeping the requested source URL. Parent links still require full group data; a mismatched, unavailable, auction or incomplete child never falls back to another variant. Existing one-megabyte limit and timeouts remain. Normal successful group imports continue unchanged.

Regression tests cover an oversized group with an explicit matching child and rejection of a parent with the same oversized group. All 738 tests pass; final lint, TypeScript/build and a fresh deployed check of the actual user URL remain required before claiming fixed. No account/order/D1/environment changes. Deploy with the Sites hosting workflow from this current release checkout and preserve Impact and current features. This preparation snapshot does not itself confirm publication; root handoff records final deployment evidence.


## Impact head verification follow-up — 8 October 2026

The user explicitly requested the partner tracking code in the main homepage head for Impact Add Website verification. RootLayout now emits script#atlas-impact-bootstrap in the server-rendered head with the exact partner script URL and both requested commands. This defines atlasStartImpactTracking; current consent still controls its invocation and external loading, and native shells remain excluded. The original queue-style bootstrap gains only a duplicate-load ID. Existing client bootstrap calls the head initializer when available and retains its earlier fallback. A new VM regression verifies static URL visibility, no load on head evaluation, both commands after start and no duplicate load. All 736 tests pass; final lint (zero errors; one existing unused Choice warning), TypeScript and Worker build passed before this follow-up publishes. Version 147 remains the last confirmed deployed version until the next successful deployment is recorded.


## Import33 / Impact release checkout — 8 October 2026

Current prepared source is C:\Users\WS\Documents\ChatGPT\atlas\outputs\deploy-import33-20261008, based on published version 146 / 4c61312ad439e98566785e10ab2f3c55d0faa556. The older primary checkout is not the publication source and has unrelated uncommitted catalog API work; preserve it. User explicitly authorized deploying this release to https://atlasmarket.uz. Use the existing public Sites project appgprj_6aa181097a00819196698407b43a6a45 with the normal source/archive/save/deploy flow. Do not publish an older checkout or alter audience, bindings, credentials, D1, DNS or proxy secrets. Record deployment success externally before claiming live status.

Imports use exact variants and automatic server verification without customer manual confirmation; unresolved blocks/prices remain honest failures. Impact's supplied async tag and its two commands start only after current consent on web, once per document; native shells excluded. 735 tests and TypeScript pass; targeted synthetic browser QA passes with no real account/order writes. Older broad audit harness guest-navigation timeout remains known; final lint, TypeScript, all 735 tests and the production Worker build passed. Root outputs retains local reports and synthetic screenshots, never source-control runtime files/secrets.


## Последние мобильные изменения — 30 сентября 2026

Рабочий Sites checkout: `C:\Users\WS\Documents\ChatGPT\atlas\.sites-checkout-atlas-20260927`. Добавлены общая ProductGallery (свайп по фото, клавиатура, кнопки), сохранение безопасных sourceImages в корзине и отдельные мобильные CSS для общих, клиентских и операторских экранов. Переключение фото не меняет вариант/цену. Все проверки UI используют синтетические ответы; D1 и реальные заказы не изменялись. Проверки физического Safari/iPhone и реального checkout остаются в TODO. Игнорируемые сценарии и скриншоты находятся в `output/playwright`; не коммитить runtime, cookies, D1 или сборку.

Этот файл можно передать другому AI вместе с репозиторием. Он рассчитан на запуск без истории текущего чата.

## Стартовый промпт

Ты продолжаешь разработку проекта Atlas в репозитории `C:\Users\WS\Documents\ChatGPT\atlas`.

Atlas — pre-release cross-border shopping сервис для пользователей из Узбекистана. Пользователь выбирает товар из каталога или вставляет ссылку на зарубежный магазин, получает предварительный расчёт в UZS, выбирает цвет/размер/модель, добавляет товар в корзину, указывает получателя и следит за заказом. Atlas выступает посредником по выкупу и логистическим агентом, а не продавцом и не производителем.

Сначала обязательно прочитай целиком:

1. `AGENTS.md`
2. `PROJECT_CONTEXT.md`
3. `ARCHITECTURE.md`
4. `LOCAL_SETUP.md`
5. `TODO.md`
6. этот файл `NEXT_AI_HANDOFF.md`
7. `ATLAS_AGENT_TEAM.md`, если задача требует параллельной работы нескольких агентов

Затем осмотри только относящиеся к задаче файлы и тесты. Не начинай с переписывания модулей «для красоты».

Рабочая копия Sites и GitHub `main` расходятся: GitHub mainline уже входит в историю Site, а локальный Site-источник содержит более поздние изменения. Перед любым внешним действием заново проверь `git status`, `git log --decorate -3`, `git branch -r` и факт push/deploy; не называй SHA опубликованным без подтверждённого результата Sites. Последний известный URL сайта:

https://atlas-uz-market.ishakovzakir0.chatgpt.site

Для задач, которые полезно делить между специалистами, используй `ATLAS_AGENT_TEAM.md`: это контролируемые короткие волны с одним владельцем каждого модуля, а не параллельное редактирование всего репозитория.

## Обязательные правила

- Сохраняй цепочку `client UI → authenticated API → domain action → D1 state`.
- Все записи аккаунта должны быть ограничены текущим аутентифицированным пользователем.
- Реальный оператор определяется только сервером по `ATLAS_OPERATOR_EMAIL`; скрытие ссылки в UI не является авторизацией.
- Не добавляй новые обязательные поля в старые Zod-схемы без миграции. Новые поля должны быть optional/default, чтобы старые аккаунты, корзины и заказы продолжали читаться.
- Сервер обязан заново проверять цену, валюту, курс, вес, вариант, аккаунт, роль, статус заказа и права доступа. Нельзя доверять сумме из браузера.
- Импорт принимает только HTTPS, allowlist магазинов, безопасные редиректы, без credentials/портов/private IP, с лимитами времени и размера ответа. Изображения тоже проходят safe-image проверки.
- Не отправляй cookies или credentials пользователей зарубежным магазинам.
- Не называй предварительный расчёт точной ценой, наличие гарантированным, а customs-оценку официальным начислением.
- Платежи, покупка, перевозчик, customs-подача и email/SMS сейчас симулированы. Никогда не утверждай, что карта списана, товар куплен или посылка реально едет.
- Не удаляй существующие функции без явного product decision.
- Не коммить секреты, cookies, `.env`, D1/R2 state, локальные runtime-папки, build output и временные архивы.
- Перед изменениями проверь `git status`. Не используй `git reset --hard` или `git checkout --`.

## Что уже есть

- Публичный каталог с реальными merchant-фото и прямыми ссылками на магазины.
- Поиск, категории, страна, бюджет, сортировка, избранное и карточка товара.
- Заказ по ссылке с importer-allowlist, JSON-LD/OpenGraph fallback и вариантами цвет → размер → цена → наличие → фото.
- Поддержка Shopify и отдельные адаптеры/проверки для Zara, Gymshark, Anker и расширенного списка магазинов одежды, косметики, кроссовок и техники.
- Batch import до десяти ссылок.
- Единый расчёт merchandise, merchant shipping, service/buyout/conversion, international shipping, delivery margin и reserve.
- Минимум международного веса 1 кг на merchant-посылку. Для одного merchant host + dispatch country упаковка `+0.3 kg` и safety allowance `+0.2 kg` добавляются один раз.
- Неизвестная доставка магазина не становится бесплатной: используется редактируемый reserve `$10`, один на заказ из магазина; от `storeShippingFreeFromUsd` ($50) товаров из магазина резерв не берётся, интерфейс пишет «без резерва», а фактическая плата магазина согласуется с клиентом.
- Cart/checkout/order flow с server-side quote verification и customs consent.
- Адреса и несколько получателей.
- Passport upload в private R2, MRZ assistance, ручное подтверждение, masked identity и удаление.
- Preview declaration package, который не отправляется в customs.
- Orders, simulated payment state, approvals, warehouse, parcel/tracking, internal notes и notifications.
- Operator queue, catalog drafts, collections, publish/hide, recheck, restrictions, analytics, backup/export и audit events.
- RU/UZ/EN выбор языка сохраняется между переходами и уже покрывает shell, link order, cart/checkout, batch import, account, passport, declaration, customs, customer orders, balance and notification shell; legacy operator/admin/legal/server-history strings remain.
- Account dashboard: state-aware next action, counters, services, exclusive accordion для вторичных разделов.
- UI-аудит `scripts/audit-ui.mjs` с guest/customer/admin permission checks, responsive overflow checks и authenticated local smoke.
- SEO-слой: canonical metadata, production title template, Open Graph/X fields, honest preliminary-quote description, static `public/robots.txt` и `public/sitemap.xml`; общий breadcrumb/footer/mobile shell использует дополнительные RU/UZ/EN ключи.
- AI-discovery: `public/llms.txt` содержит короткое фактологическое описание продукта, `OAI-SearchBot` и `GPTBot` явно разрешены только для публичных страниц. Это повышает crawlability, но не гарантирует попадание или позицию в ChatGPT Search.
- Guest manual-link entry now preserves the exact product return path through sign-in instead of sending a guest into a protected calculation with no explanation.
- Account next action prioritizes an approval, simulated payment, active order, cart and recipient; the passport is not an unsolicited first screen. Saved-address entry has local autocomplete/datalist suggestions and no external address lookup.
- Shared catalog/product-sheet/provider error handling follows RU/UZ/EN. Remaining operator, legal and server-authored history text stays a deliberate translation backlog.
- Order-document downloads are still private attachment/no-store responses and now send `X-Content-Type-Options: nosniff`.
- September 26 GitHub branches were reviewed selectively: do not merge their heads wholesale. `market_staff_directory` must not grant operator access; only `ATLAS_OPERATOR_EMAIL` does. Sephora `linkJSON` accepts exact listing only; account/cart two-step deletion, storage notice and cron source configuration are described in `PROJECT_CONTEXT.md`. The separate cron Worker is not live until deployed with its secret.

## Текущий UX baseline

Личный кабинет должен ощущаться как спокойный сервисный центр, а не как набор маркетинговых карточек.

- Верхний блок показывает только одно следующее действие: approval, simulated payment, passport, address или current order.
- Ниже четыре компактных показателя и шесть сервисов.
- Вторичные разделы (addresses, customs, documents, support) открываются только по одному. Не возвращай CSS grid stretch, при котором соседняя панель выглядит раскрытой.
- Не добавляй повторный `eyebrow + h2 + summary` для одного смысла.
- Сохраняй спокойные borders, минимум одинаковых rounded cards, ясную типографическую иерархию и мобильную читаемость.
- Если правишь UI, проверяй не только пустой guest screen, но и аккаунт с заказами, pending approval, pending payment, паспортом и адресом.

## Главные директории

- `app/` — страницы и клиентские представления.
- `app/account-views.tsx` — account и customs views.
- `app/order-workspace.tsx` — orders и notifications.
- `app/shopping.tsx` — cart/checkout.
- `app/deals-feed.tsx` — catalog.
- `app/global-link-order.tsx` — link import/order.
- `app/catalog-admin.tsx` — operator catalog.
- `app/identity-workspace.tsx` — passport and declaration workflows.
- `app/experience.css`, `app/atlas-design.css`, `app/globals.css` — shared visual layers.
- `lib/market/domain.ts` — schemas, pricing, state transitions and domain invariants.
- `lib/market/server.ts` — account loading, identity, persistence and server authorization.
- `lib/market/catalog.ts`, `lib/market/catalog-editor.ts` — public/editorial catalog.
- `lib/importer/` — URL security, store adapters and parsers.
- `app/api/` — authenticated API routes.
- `tests/*.test.mjs` — domain/security/API tests.
- `scripts/audit-ui.mjs` — headless browser audit.
- `.openai/hosting.json` — existing Sites project binding; do not create a second site.

## Запуск и проверка на Windows

В обычном PowerShell `node`/`npm` могут отсутствовать в PATH. Используй bundled runtime:

```powershell
$env:PATH='C:\Users\WS\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;'+$env:PATH
```

Основные команды:

```powershell
node node_modules/eslint/bin/eslint.js . --ignore-pattern dist --ignore-pattern .next --ignore-pattern outputs
node node_modules/typescript/bin/tsc --noEmit
node --experimental-strip-types --test tests/*.test.mjs
node scripts/run-framework.mjs build
node scripts/audit-ui.mjs http://localhost:5173
```

Для release-кандидата с публичным каталогом потребуй реальные свежие карточки вместо безопасного пустого режима:

```powershell
$env:ATLAS_AUDIT_REQUIRE_CATALOG='1'
node scripts/audit-ui.mjs http://localhost:5173
Remove-Item Env:ATLAS_AUDIT_REQUIRE_CATALOG
```

Если dev server уже работает на `http://localhost:5173`, не убивай чужой процесс и не запускай второй сервер. UI audit создаёт временный Chrome profile и удаляет его после проверки.

После meaningful product/architecture/API/persistence/deployment change обнови `PROJECT_CONTEXT.md`, `ARCHITECTURE.md` и `TODO.md`.

## Как публиковать

Публикуй только по прямому запросу пользователя и после lint, tests, TypeScript, audit и production build. Успешные проверки сами по себе не являются разрешением на deploy. Для Sites используй существующий `project_id` из `.openai/hosting.json`, запроси короткий source repository credential, push exact HEAD, package build output, save version с полным SHA, deploy saved version и дождись succeeded. Credential нельзя писать в файл, git config, remote URL или ответ пользователю. Никогда не создавай новый Sites project.

## Что ещё не является готовым к коммерческому запуску

- Реального payment provider, webhook, reconciliation и refund processor нет.
- Реального carrier booking/tracking нет.
- Email/SMS только persistent preview; внешней доставки нет.
- Standalone email/password, recovery, phone verification и Google OAuth не подключены.
- Один операторский email вместо самостоятельных staff identities/permissions.
- FX/tariffs управляются оператором; verified live feed не подключён.
- Customs estimator информационный, не официальное начисление.
- Passport OCR best effort; нужен production identity provider, quality checks, retention/legal review.
- JSON account state совместим с prototype, но не подходит для большой нагрузки без дальнейшей нормализации/transactional outbox.
- Полная RU/UZ/EN локализация legacy forms, validation и legal/operator text ещё не закончена.
- Scheduled catalog refresh/price alerts/recent views/saved searches ещё не реализованы.
- The 20 September editorial batch adds six direct Amazon/eBay product cards selected from Slickdeals. Slickdeals is provenance only: cards and import use canonical merchant URLs and merchant-hosted images, with seven-day expiry and protected recheck. Verify availability, pricing and image/affiliate rights before treating any pick as launch inventory.
- Amazon.com verification now pins a request-scoped anonymous session to USD/English and US ZIP 19701 before parsing the page; it validates Amazon's returned address and reads the post-location price block. No account login or persistent cookies are involved. Amazon HTML gets a separate bounded 6 MB ceiling for its large client-side state; ordinary pages remain capped at 3 MB. The authenticated import route bypasses the generic cache for Amazon so older snapshots cannot skip this handshake. Extend this per-store only after verifying the merchant's own public location endpoint.
- Adidas product links use the bounded `/api/plp/content-engine` card first and enrich it with same-host `/api/search/product/{article}` JSON when HTML is an Akamai challenge. The adapter matches the article code, carries sale price, gallery and available sizes, retries the fixed apex edge route after a rate limit, and keeps add-to-cart blocked until a protected source check succeeds when both public sources are blocked.
- Link ordering no longer asks a customer to open a merchant page and report availability. It retries the protected import automatically, keeps the explicit loaded-data/variant consent checkbox, and the server still rechecks the selected source before cart addition and checkout. Single-option catalog fallbacks may use a different neutral label than the merchant; server verification normalizes that case only when the live source has exactly one available option.
- Affiliate/merchant image reuse, legal entity, INN, bank details and Uzbek legal review ещё нужны.
- The local D1 catalog state examined on 20 September 2026 contained stale 11 September observations, so the seven-day public freshness boundary correctly made `/api/catalog` empty. The ordinary UI audit records catalog-card checks as skipped in this safe-empty state; the `ATLAS_AUDIT_REQUIRE_CATALOG=1` release mode correctly blocks it. Import/recheck and operator-publish fresh real snapshots before a public catalog release; do not fake dates merely to populate the UI.
- The standard static security pass found no confirmed source-code vulnerability, but did not prove Sites/Cloudflare edge headers or the trusted-host injection/stripping of platform identity headers. Verify that boundary before launch. Replace/redesign `import-legacy` before any real payment, shipment, entitlement or stored-value feature.

## Рекомендуемый первый рабочий цикл

1. Прочитай все handoff-документы и проверь `git status`.
2. Запусти lint, TypeScript, tests, build и browser audit до изменений, чтобы зафиксировать baseline. If the catalog is empty because its snapshots have expired, record that truthful freshness outcome and refresh/review real merchant data rather than weakening the expiry guard.
3. Проверь задачу на конкретном route и найди соответствующий API/domain action до редактирования UI.
4. Сделай маленький совместимый patch. Не меняй схему D1 без необходимости.
5. Проверь guest, authenticated customer, operator и mobile states.
6. Обнови handoff docs и TODO.
7. Повтори проверки, commit, push и только потом publish.

## Готовые промпты для следующих запусков

Каждый блок ниже можно отправлять новому AI отдельным сообщением после стартового промпта.

### 1. Полный аудит перед продолжением

> Пройди весь Atlas как senior product engineer и UX lead. Сначала зафиксируй baseline командами из `NEXT_AI_HANDOFF.md`, затем проверь все публичные и защищённые routes, guest/customer/operator gates, API authorization, данные старых аккаунтов, мобильный overflow и повторяющиеся UI-паттерны. Не переписывай код только ради стиля. Составь короткий список P0/P1/P2 с файлами и доказательством, затем исправь только P0/P1. После этого повтори проверки и обнови handoff-документы.

### 2. Полировка клиентского кабинета

> Продолжи работу с `/account`. Проверь состояния: пустой аккаунт, pending payment, pending approval, confirmed passport, no address, several addresses, open support ticket и completed orders. Сделай следующий шаг очевидным, не раскрывай соседние панели, не дублируй заголовки и не превращай экран в сетку одинаковых карточек. Сохрани все существующие действия и API. Добавь browser audit checks для каждого исправленного состояния.

### 3. Каталог и импорт магазинов

> Улучши связку public catalog → exact merchant URL → protected link import → variant confirmation → cart. Добавляй магазин только через explicit allowlist и безопасный адаптер. Для каждого supported page проверь title, image, currency, dispatch country, boxed weight, color, size, price and availability. Не показывай Slickdeals/deal aggregator пользователю. При stale/blocked/unavailable source не заставляй клиента открывать магазин и подтверждать наличие вручную: автоматически повтори безопасную проверку, покажи понятный статус и блокируй cart/checkout до серверного подтверждения. Admin availability report оставь как операторский/совместимый API.

### 4. Расширение operator catalog

> Улучши `/admin` как рабочую очередь, а не CMS-витрину. Нужны импорт ссылок пачкой, draft/recheck/attention/publish/hide, collections RU/UZ/EN, no-image/no-variants checks, availability reports и safe direct merchant links. Не перезаписывай операторские правки bundled seed sync-ом. Проверяй optimistic revision и server role; клиентский UI не является authorization.

### 5. Полная локализация

> Доведи RU/UZ/EN на всех transactional routes. Найди hardcoded Russian/English labels, validation messages, empty states, statuses, legal/operator copy и notification templates. Не переводи автоматически названия товаров, merchant names, URLs и юридические цитаты. Используй существующий account language state, не добавляй client-only localStorage для account data. После каждого блока добавляй smoke check на смену языка и reload.

Текущий прогресс: селектор языка сохраняется в валидированном `atlas-language`, применяется сразу и после входа повторяется через `communication-save`, поэтому full-page переходы больше не должны сбрасывать язык. Локализованы основные клиентские маршруты, customer order cards/modals, balance/notifications и dynamic link-import messages. Следующая очередь — `OperatorOrderTools`, `admin-view.tsx`, `catalog-admin.tsx`, `legal-documents.tsx`, server-generated history/errors и оставшиеся toast/validation strings.

### 6. Безопасный запуск auth/payment

> Не подключай реальные деньги или пароли вслепую. Сначала составь integration decision record: provider, webhook verification, idempotency, refunds, reconciliation, PII retention, phone verification, recovery, Google OAuth and operator staff roles. Привяжи каждое решение к текущему API/domain state и миграциям. Пока провайдер не выбран и legal review не пройден, оставляй simulated flows и честные notices.

### 7. Предрелизная готовность

> Проверь Atlas как закрытый pilot: реальные merchant fixtures, stale price/availability behavior, customs copy, terms/privacy/passport consent, export/delete, error monitoring, D1 backup/restore, operator audit, mobile checkout, support flow и fallback when a store blocks requests. Не называй проект production-ready, пока не закрыты real payment, carrier, email/SMS, auth, legal entity и customs/legal review.

## Формат ответа следующего AI

В каждом рабочем цикле сообщай:

1. что именно проверено;
2. какие файлы изменены и почему;
3. какие API/domain invariants сохранены;
4. какие команды прошли и какие не удалось выполнить;
5. что осталось в TODO;
6. опубликован ли exact commit или работа осталась локальной.

Не говори «сделано идеально», если часть ограничений из раздела «не готово к коммерческому запуску» ещё существует.
