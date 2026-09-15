# Atlas — handoff для следующего AI-агента

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

Затем осмотри только относящиеся к задаче файлы и тесты. Не начинай с переписывания модулей «для красоты».

Текущий подтверждённый baseline: commit `e7ff392e0711ea1785d97e1727e93f15fd8e5cc7`. Он отправлен в `origin/main`. Последний опубликованный сайт:

https://atlas-uz-market.ishakovzakir0.chatgpt.site

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
- Неизвестная доставка магазина не становится бесплатной: используется редактируемый reserve `$10`.
- Cart/checkout/order flow с server-side quote verification и customs consent.
- Адреса и несколько получателей.
- Passport upload в private R2, MRZ assistance, ручное подтверждение, masked identity и удаление.
- Preview declaration package, который не отправляется в customs.
- Orders, simulated payment state, approvals, warehouse, parcel/tracking, internal notes и notifications.
- Operator queue, catalog drafts, collections, publish/hide, recheck, restrictions, analytics, backup/export и audit events.
- RU/UZ/EN выбор языка в shell и новых ключевых участках, но не полная локализация всех legacy-строк.
- Account dashboard: state-aware next action, counters, services, exclusive accordion для вторичных разделов.
- UI-аудит `scripts/audit-ui.mjs` с guest/customer/admin permission checks, responsive overflow checks и authenticated local smoke.

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

Если dev server уже работает на `http://localhost:5173`, не убивай чужой процесс и не запускай второй сервер. UI audit создаёт временный Chrome profile и удаляет его после проверки.

После meaningful product/architecture/API/persistence/deployment change обнови `PROJECT_CONTEXT.md`, `ARCHITECTURE.md` и `TODO.md`.

## Как публиковать

Публикуй только после lint, tests, TypeScript, audit и production build. Для Sites используй существующий `project_id` из `.openai/hosting.json`, запроси короткий source repository credential, push exact HEAD, package build output, save version с полным SHA, deploy saved version и дождись succeeded. Credential нельзя писать в файл, git config, remote URL или ответ пользователю. Никогда не создавай новый Sites project.

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
- Affiliate/merchant image reuse, legal entity, INN, bank details and Uzbek legal review ещё нужны.

## Рекомендуемый первый рабочий цикл

1. Прочитай все handoff-документы и проверь `git status`.
2. Запусти lint, TypeScript, tests, build и browser audit до изменений, чтобы зафиксировать baseline.
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

> Улучши связку public catalog → exact merchant URL → protected link import → variant confirmation → cart. Добавляй магазин только через explicit allowlist и безопасный адаптер. Для каждого supported page проверь title, image, currency, dispatch country, boxed weight, color, size, price and availability. Не показывай Slickdeals/deal aggregator пользователю. При stale/blocked/unavailable source дай понятный manual confirmation и admin availability report. Сервер должен перепроверять всё перед cart/checkout.

### 4. Расширение operator catalog

> Улучши `/admin` как рабочую очередь, а не CMS-витрину. Нужны импорт ссылок пачкой, draft/recheck/attention/publish/hide, collections RU/UZ/EN, no-image/no-variants checks, availability reports и safe direct merchant links. Не перезаписывай операторские правки bundled seed sync-ом. Проверяй optimistic revision и server role; клиентский UI не является authorization.

### 5. Полная локализация

> Доведи RU/UZ/EN на всех transactional routes. Найди hardcoded Russian/English labels, validation messages, empty states, statuses, legal/operator copy и notification templates. Не переводи автоматически названия товаров, merchant names, URLs и юридические цитаты. Используй существующий account language state, не добавляй client-only localStorage для account data. После каждого блока добавляй smoke check на смену языка и reload.

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
