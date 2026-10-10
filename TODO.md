## Оформление, «Мои заказы», сайт: открытые вопросы после аудита — 10 октября 2026

- **Решения владельца приняты 10.10.2026** (см. ARCHITECTURE.md): согласие без галочки, одна строка «Сервис Atlas», «в Ташкент», закреплённая кнопка на телефоне. Открыто: сроки доставки на широких экранах повторяются трижды (подзаголовок тарифов, карточка маршрута, FAQ) — оставить одну карточку?
- [x] **Страховка:** претензии об утере и порче оформляются в заказе, возмещение — на баланс; раздел 6.1 оферты (10.10.2026). Осталось: фото к претензии загружаются через поддержку, не в форме; юрист должен проверить раздел 6.1 вместе с остальной офертой.
- [x] **«Ташкент»** во внутренних экранах (инвестор, кнопка и подсказка оператора, `llms.txt`) — сделано 10.10.2026, см. ARCHITECTURE.md «Остатки аудита».
- [x] **Страховка:** при изменении цены товара и доплате за товар страховка пересчитывается по ставке строки (10.10.2026). Ставка по порогу $200 после оформления не меняется.
- [x] **Коды ошибок сервера:** «Расчёт истёк», «Тарифы обновились», «Пошлина пересчитана» — `err_75`–`err_77`, после них клиент перечитывает аккаунт. Остались без кодов другие отказы `checkoutCart` («Корзина пуста», «Корзина изменилась», «Корзина пересчитана», «Подтвердите таможенные условия» и др.).
- [x] **Лимит:** калькулятор таможни и «Пошлины нет · останется $X» считают от лимита тарифа и вычитают текущую корзину. Открыто: константа $200 (`courierAllowanceUsd`) ещё стоит в каталоге (`catalog-view.tsx`, `catalog-teaser.tsx`, `catalogAllowance` в `lib/market/allowance.ts`), кабинете (`account-views.tsx`), паспортах (`identity-workspace.tsx`) и «Мои заказы» (`order-workspace.tsx` ~886) — при изменении лимита в тарифе там останется $200.
- **Заказы:** кнопки ответа на изменение заказа теперь показывают «Сохраняем…» и сообщение об успехе (10.10.2026). Осталось: ветки `!operations` в старой карточке отдельного заказа фактически только для оператора — можно убрать покупательскую часть.
- [x] **Доставка только по Ташкенту** (решение владельца 10.10.2026, «пока»): в формах получателя город зафиксирован, области убраны, сервер отвечает `err_78` на адрес вне Ташкента. Вернуть области — дописать их в `servedRegions` (`lib/market/addresses.ts`). Открыто: в корзине выбор получателя для расчёта пошлины всё ещё показывает получателей вне Ташкента.
- [x] **Каталог:** у карточек, которые ведёт магазин (`autoManaged`), можно убрать лишний цвет или размер — сервер хранит список исключений `excludedOptions`, обновления из магазина их не возвращают (10.10.2026). Возвращённый цвет/размер появляется после следующей проверки магазина.
- [x] **Импорт:** запрос с `fresh` (заказ по ссылке, «Повторить автозагрузку») обходит запомненную стену через 15 с; обычный — через 90 с.
## Target native API headers

US VPS comparison: Target redsky returned product JSON200 with ordinary API headers and with User-Agent, but435 PerimeterX metadata after adding browser hints/X-Requested-With/Sec-Fetch headers. Target requests now retain HTTPS/Origin/Referer/allowlist/timeout and use minimalApi headers, omitting those browser-only hints. Other merchant requests are unchanged. Regression checks the actual fetchProduct headers. No IP-reputation verdict is inferred from435 alone.

## Native API Origin follow-up

The signed proxy permits both Referer and Origin from the exact known storefront for credential-free GETs to redsky.target.com and api.victoriassecret.com. All other cross-host sources remain rejected; Origin must still equal its parsed HTTPS origin. Initial hosted checks exposed that requestHeaders sends both headers. Regression covers exact accepted Origin and unrelated rejected Origin. Mango source parsing verified on the US VPS and hosted site: USD79.99/18 variants.

## PR39 production preparation

Signed proxy validation now permits only exact GET Referer pairs www.target.com→redsky.target.com and victoriassecret.com/www.victoriassecret.com→api.victoriassecret.com; Origin restrictions and HTTPS/allowlist/credential/port checks remain. Signed HTTP regressions cover accepted pairs and rejected unrelated/insecure/credentialed sources. Target groups exceeding120 leaves remain incomplete after truncation. These fixes are required for US proxy operation and safe automatic publication. VPS host snapshot must preserve existing hosts and include redsky.target.com.

## Браузерный движок, незнакомые сайты, доплата — 10 октября 2026

- [x] Браузерные магазины читаются только ташкентским шлюзом на ПК владельца. ПК по решению владельца 10.10.2026 всегда включён (будет сервером); при сбое шлюза — ручной ввод.
- [ ] Браузер на US VPS технически возможен (Xvfb + обычный Chrome), но адрес дата-центра режут Akamai/PerimeterX — проверять только с разрешения владельца, на проде не включено.
- [ ] Walmart с 10.10.2026 читается со страницы через шлюз ПК; Bright Data — запасной. Когда ПК выключен, Walmart идёт в Bright Data (если задан ключ), иначе ручной ввод. Проверить на проде после выкатки PR #46.
- [ ] Единая оплата заказа: старые заказы с разными `payment.id` в одном оформлении показывают id первой строки; провайдера оплаты по-прежнему нет. Оператор в `/operations` отмечает оплату по строкам, как раньше.
- [ ] Браузер на US VPS: инструкция для ассистента с доступом к VPS — `outputs/prompts/2026-10-10-vps-browser-test.md` (только замер, прокси не трогать). Ждём отчёт.
- [x] Macy's: категория берётся из хлебных крошек страницы (`breadcrumbCategory`), по названию — только если крошек нет.
- [ ] Columbia и Best Buy отвечают 403 даже настольному Chrome — остаются ручным вводом.
- [ ] Эффект на проде — только после выкатки PR #46 и обновления файлов шлюза (сделано на ПК 10.10.2026, откат — `backup-20261010`).
- [ ] Доплата: оплата симулируется, как оплата заказа; при подключении провайдера нужен реальный платёж и возврат доплаты отдельной операцией. Возврат части доплаты (не всего заказа) не реализован.
- [ ] Незнакомые сайты принимаются без живой проверки: цену, вариант и доставку сверяет оператор; доплата закрывает расхождение вверх, расхождение вниз — через существующий возврат по заказу.

## Магазины: живая проверка, ускорение импорта — 10 октября 2026

Ручной ввод — только Columbia и Best Buy (`manualEntryStoreRoots`). Браузером ташкентского шлюза читаются 26 магазинов (`browserStoreRoots`); ПК со шлюзом по решению владельца всегда включён. H&M, Sephora и другие браузерные магазины показываются без пометок. Ручной ввод — запасной путь на случай сбоя шлюза.

- [x] Живая проверка ~200 магазинов списка с ташкентского адреса (fetch → impit → Chrome шлюза): 116 читаются. Девятнадцать магазинов читаются только браузером, они добавлены в `browserStoreRoots`: Next, Stradivarius, COS, Farfetch, Hoka, Micro Center, Mytheresa, Oysho, Nordstrom, Nordstrom Rack, JD Sports, La Redoute, Monoprice, LuisaViaRoma, Neiman Marcus, Notino DE/FR/IT, Otto. Ещё 11 — только через отпечаток Chrome (`impersonateStoreRoots`).
- [x] Поддомены, которые раньше отвергались: en.aboutyou.de, us.burberry.com, store.google.com, shop.lululemon.com, us.louisvuitton.com, us.nothing.tech, us.pandora.net, www.usa.philips.com, electronics.sony.com.
- [ ] Не открылись даже в Chrome шлюза (стена 403). Это кандидаты в ручной ввод, но проверены только с ташкентского адреса; на проде есть US VPS и резидентный маршрут:
  - Dell, Etsy, Fnac ES, Free People, Galaxus DE, JCPenney, Kiabi ES;
  - Kohl's, Mango (на странице; свой адаптер есть), MediaMarkt DE/ES, Revolve, Saks;
  - Saturn DE, Sephora ES, Urban Outfitters, Wayfair.
  Решить после проверки с VPS.
- [ ] Страница открывается, но в ней нет структурированной цены или валюты: импорт уходит в черновик. Нужны адаптеры по приоритету продаж:
  - Nike, Carhartt, Foot Locker ES, GOAT, GoPro, Hollister, JBL, J.Crew, Lacoste, LG;
  - Logitech, Madewell, Merrell, Mi, Newegg, Notino ES, Patagonia, PcComponentes, Prada, Pull&Bear;
  - Razer, Salomon, Skechers, Space NK, SSENSE, StockX, Swarovski, Tiffany, UGG, Zara Home.
- [ ] Ошибка сети или разбора, повторить: Victoria's Secret ES, Lefties, Massimo Dutti, YOOX, iHerb, Microsoft, Milk Makeup.
- [ ] Выкатка на шлюз и VPS: переэкспортировать allowlist и подсказки движков командой `node --experimental-strip-types scripts/export-importer-hosts.mjs supported-store-hosts.json importer-engine-hints.json`. Скопировать оба файла и новые `importer-proxy-server.mjs` и `merchant-engines.mjs`, затем перезапустить прокси. Без `importer-engine-hints.json` прокси работает, как раньше.
- [ ] Ручной ввод не проверяет цену: оператор сверяет её со страницей перед выкупом; расхождение вверх закрывает доплата по заказу.
- [ ] Память маршрутов (`createRouteMemory`) живёт в изолированном процессе Worker и не общая. Отказавший маршрут пропускается для магазина на 5 мин. Если шлюз ненадолго не ответил, браузерные магазины эти 5 мин уходят в ручной ввод.
- [x] Ускорение импорта (ветка `feat/orders-psychology-import`, тесты `tests/importer-speedups.test.mjs`):
  - добавление в корзину берёт ответ магазина из `market_import_cache`, если сервер записал его не раньше 2 мин назад (Amazon US — всегда вживую);
  - одно написание ссылки `canonicalProductUrl()` для кэша, корзины и очереди оператора;
  - короткие ссылки a.co, amzn.to, amzn.eu, amzn.asia, ebay.us раскрываются, m.<магазин> читается как www;
  - в `/api/import`: один запрос к магазину на одну страницу, стена помнится 90 с, кэш проверяется до списания лимита;
  - разбор JSON-LD и микроразметки стал терпимее;
  - внутренние имена магазинов («beta-anker-us») больше не показываются брендом;
  - Shopify вне списка корней: цена и варианты из `/products/<handle>.js`;
  - лимит страницы 6 МБ, запросы Adidas идут параллельно;
  - прокси получает срок попытки (`deadlineMs`).
- [ ] Выкатка на шлюз и VPS: новые `deploy/upcloud/importer-proxy-server.mjs` и `merchant-engines.mjs` (срок попытки из подписанного запроса, остановка движков при обрыве соединения). Старый прокси поле `deadlineMs` игнорирует, новый без него ждёт 13 с, как раньше.
- [ ] Короткие ссылки раскрывает сам Worker, без прокси: хосты сокращателей не входят в allowlist прокси. Вживую a.co/amzn.to с адреса Cloudflare не проверялись. Если сокращатель не ответит за 3 с, ссылка идёт прежним путём.
- [ ] Ожидание одинаковых запросов и память стен живут в одном изоляте Worker. Два изолята могут спросить магазин дважды. Повтор с `fresh` в течение 90 с после стены получает тот же ответ, без запроса к магазину.
- [ ] Добавление в корзину находит запись кэша, только если `product.sourceUrl` совпадает с каноническим адресом импорта. Если магазин перенаправил на другой адрес, товар проверяется вживую, как раньше.
- [ ] `canonicalProductUrl` не сокращает пути Amazon до `/dp/<ASIN>`: общего помощника нет, решение отложено.
- [ ] Shopify-дозапрос `.js` делается, только если страница объявляет `Shopify.currency`. Headless-витрины вроде Anker (`/products/x.js` отдаёт HTML) остаются на своих адаптерах.

## Bright Data для Walmart (H&M убран 10.10.2026) — 9 октября 2026

- [ ] Выкатка: секрет Worker `BRIGHTDATA_API_KEY` и миграция `drizzle/0012_provider_jobs.sql` на рабочей D1 (см. `AUTH_SETUP.md`, раздел 10). Без секрета Walmart идёт прежним путём.
- [ ] Перевыпустить ключ Bright Data: тот, что использовался при разработке, был на скриншоте.
- [ ] Walmart через Bright Data отдаёт один вариант на запись (без матрицы цвет × размер); со страницы через шлюз матрица полная.
- [ ] Бесплатный лимит считается по месяцу Ташкента, а Bright Data может считать по UTC или по дате подписки: сверить с первым счётом и при расхождении поправить `freeRecordsPerMonth` или проводку вручную.
- [x] Два одновременных запроса одного товара больше не запускают сбор дважды. Бронь `claim:` в `market_provider_jobs` ставится атомарно по `item_key`, второй запрос ждёт тот же снимок. Бронь без снимка закрывается через 60 с.
- [ ] Цена Walmart $1,43 (до скидки $5,98) у футболки George — сверить вручную со страницей: могла быть цена отдельного размера или распродажи.

## Old Navy, Gap, Banana Republic, Ulta, Macy's — 9 октября 2026

- [x] Ulta: цены остальных оттенков и объёмов дозапрашиваются страницами `?sku=` (до 24 вариантов, по 4 параллельно, 7 с на всё). Вариант без цены остаётся с предупреждением.
- [ ] Gap Inc.: Athleta подключена по тому же формату, но вживую не проверялась — API каталога для неё не вернул товаров. Страницы весят 1,2–2 МБ при лимите 6 МБ (`readBody`, с 10.10.2026); если карточка превысит лимит, импорт уйдёт в черновик с пометкой `oversize`.
- [ ] Old Navy, Gap и Ulta проверены с домашнего адреса; с адреса VPS не проверялись.
- [ ] Macy's: Akamai 403 отовсюду, включая резидентный прокси. Нужен товарный фид Rakuten Advertising (publisher-аккаунт, не кэшбэк rakuten.com) и адаптер фида; разборщик `macys.ts` для страницы остаётся.

## Свой движок загрузки страниц — 9 октября 2026

- [x] Выкатить `merchant-engines.mjs` + `npm ci --omit=dev` на VM UpCloud и повторить прогон 16 ссылок с нью-йоркского адреса (сделано 9.10, Sites 155).
- [ ] Обновить на VM `importer-proxy-server.mjs`, `merchant-engines.mjs` (попытки при полном провале) и `supported-store-hosts.json` (новый хост `redsky.target.com`), затем проверить Mango, Target, Zara и Victoria's Secret с VPS.
- [ ] Ключ веб-клиента Target (`lib/importer/target.ts`) и параметры redsky могут смениться без предупреждения — тогда импорт Target откатится к черновику. Следить за `[import-fallback]` для `www.target.com`.
- [ ] Zara через `?ajax=true` проверена на US-витрине; другие страны (RON и т. п.) — только на фикстурах.
- [ ] Victoria's Secret: из Узбекистана и страница, и API отвечают 403; проверить с VPS.
- [ ] Ступень 2 — браузер (Patchright/Chromium) на VM для страниц, где данные рисует JS (H&M, New Balance, Levi's; Mango и Target уже читаются без браузера) и для PerimeterX (Walmart; Zara идёт через `?ajax=true`). Нужна VM ~4 vCPU / 8 ГБ, очередь и лимит параллельных вкладок.
- [ ] Ступень 3 — резидентные US-прокси ($1–4/ГБ) только для хостов, где не помогли ступени 1–2 (Sephora, Best Buy, Columbia, Victoria's Secret). Учёт трафика по хосту.
- [ ] С адреса VPS (дата-центр UpCloud) 403 на обоих движках у Tommy, Carter's, Sephora, Columbia, H&M; Zara — Akamai. Tommy с домашнего адреса открывается обычным запросом — значит, нужен другой адрес (ступень 3), а не только другой отпечаток.
- [ ] Официальные источники вместо скрейпинга: Best Buy Products API, Walmart affiliate API — не проверены (Zara и Target уже читаются из своих источников данных).
- [ ] Память лучшего движка живёт в процессе прокси. После рестарта известные трудные магазины стартуют по подсказкам (`importer-engine-hints.json`, 10.10.2026), остальные — с fetch. Метрик успеха по хостам нет: есть только строки в journal.

## Опубликовано: общая механика вариантов и автоимпорт — 9 октября 2026

Sites154 опубликован: source e96dc890af3ba8a3b658e7e9ef41f2451ee8f73f, deployment appgdep_6ac7ebfd75d481918778747933de3742 succeeded; atlasmarket.uz. Канонический checkout outputs/deploy-import33-20261008; старый корневой checkout не публиковать. Добавлены optional native source/product/seller/offer/color IDs, независимые параметры, собственные галереи и полнота группы. Новые cart-add поддерживаемых магазинов требуют автоматической серверной проверки без ручного обхода. Админский пакетный импорт автоматически публикует только полные группы с точными доступными вариантами, ценами и фото; неполные остаются в очереди повторной проверки. Недоступные и неизвестные варианты не добавляются.

761 тест, TypeScript и build проходят, lint 0 ошибок/2 прежних предупреждения. Свежий public API по ссылке пользователя:200,22 доступных SKU/4 цвета, Cargo US11 $32. Все22 проверены сервером и importDraft. Браузер с синтетическими API проверил22 точных cart ID/var, цены25/24/32/34, собственные галереи, US/EU/CM и mobile390. Реальное сохранение каталога проверено на тестовой SQLite через catalog-server, с CAS и аудитом; hosted operator D1 UI отдельно не проверялся. Реальные аккаунты/заказы не изменялись, окружение revision11 сохранено.

Ограничение: регистрация33 магазинов не означает полную работу33 источников. Аудит: eBay/Nike/Zalando/Vans дают подтверждённые поднаборы;10 неполных,11HTTP422,6 ошибок транспорта проверки,2 без контрольной ссылки товара. Полнота Nike/generic не подтверждена, автопубликация её не выдумывает. US-egress каждого текущего запроса отдельно не сертифицирован; разрешён прямой fallback. Внешний доступ/API остаётся зависимостью. Доказательства outputs/all-stores-deployment.json, merchant-mechanics-audit.md, all-stores-*.log, release-ui-general-check.js.log.

# Atlas TODO and known limitations


## Общая механика импорта — 9 октября 2026

Подготовлен релиз поверх опубликованной версии 152: optional точные product/seller/offer/color IDs, native дочерние ссылки, независимые параметры, галереи и полнота группы. Клиент и сервер сохраняют цену конкретного предложения; новые добавления из поддерживаемых магазинов не обходят проверку ручным флагом. Неизвестное наличие и нулевые остатки не допускаются. Админский пакетный импорт автоматически публикует только полные подтверждённые группы и сохраняет неполные в очереди повторной проверки; скрытие останавливает автоматическое управление.

Аудит 33 источников: проверенные поднаборы eBay25/Nike68/Zalando20/Vans4; это не доказательство полноты всех магазинов. 10 источников неполны, 11 ответили422, 6 транспортных ошибок проверки, 2 без контрольной ссылки товара. US-egress текущей проверки отдельно не сертифицирован; прямой fallback существует. Подробности outputs/merchant-mechanics-audit.md. Внешние API/доступ для остальных источников остаются зависимостью. Автоимпорт не гарантирует будущие цену/наличие/доставку.

# Atlas TODO and known limitations

## eBay: цена просматриваемой расцветки — 8 октября 2026

Верхняя цена и поле цены следуют просматриваемым цвету/размеру, отдельно от списка ранее выбранных вариантов и общего расчёта. Каждая расцветка показывает свою цену или диапазон; размеры показывают цену, если в группе есть разница. Серверные точные ID/цены и многовариантная корзина сохранены. Проверенный снимок eBay: красный $25, серый $24, Blanch Cargo $32, белый/лайм $34; var459336456425 — Blanch Cargo US11 $32. 745 тестов, TypeScript, lint и build проходят. Живая браузерная перепроверка и публикация выполняются после подготовки.

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


## Import33 / Impact release — 8 October 2026

- [x] Integrate on published version 146 rather than the older primary checkout; preserve current product features and official eBay API configuration.
- [x] Register the requested 33 storefronts and validate exact option selection, automatic server checks and old-state compatibility; 735 tests pass.
- [x] Add the supplied Impact script, existing consent gating, updated legal disclosure and native-shell exclusion; synthetic browser checks pass before/after consent.
- [ ] Publish the prepared release and record the succeeded deployment/version/source; final lint/build required.
- [ ] Repair the older audit-ui synthetic guest-navigation harness timeout; targeted release flows pass but the broad audit does not.
- [ ] Obtain reliable approved merchant data for blocked US pages and missing prices; 17 representative public-page merchants plus eBay API are confirmed, not all 33. Unknown stock remains unconfirmed. Test further live product/variant coverage and authenticated hosted operator/customer flows without changing real orders.



## Кабинет, вход и скорость — 7 октября 2026

- `scripts/audit-ui.mjs` давно не гонялся и местами устарел (после `signIn()` ждёт `.docs-step`, не открыв `/identity`); проверки гостевого доступа переписаны под переход на `/login`, но весь прогон не уложился в 9 минут — пройти аудит целиком и починить шаги.
- Скорость: CSS — 123 КБ gzip одним файлом на каждой странице (43 глобальных файла в `app/layout.tsx`, много переопределений); стоит вычистить мёртвые правила и вынести стили админки/бухгалтерии из общего бандла. В клиентском `store` лежит Zod (~42 КБ gzip с sonner) — проверка ответов сервера на клиенте может обойтись без него. `market-ui` тянет Radix Select и тексты калькулятора на все страницы.
- Фото товаров приходят с сайтов магазинов без уменьшения (каталог на телефоне ~370 КБ картинок); нужен ресайз через прокси/Images, когда хостинг позволит.
- Локальный `wrangler` (сборка, порт 8799) иногда падает с пустой ошибкой после `smoke:auth`; e2e после перезапуска проходит.
- Скорость: шапка на каждой странице грузит `history-copy` (~9 КБ gzip) ради списка в панели уведомлений; можно грузить тело панели лениво с предзагрузкой в простое — не сделано, чтобы первое открытие панели оставалось мгновенным. В общем чанке `store` остаются Zod (~57 КБ до сжатия) и sonner.

## Плавные переходы и панель уведомлений 2.0 — 7 октября 2026

- [ ] Межстраничные View Transitions, панель уведомлений и переход «получатель ⇄ проверка» проверены в Chrome и в движке Safari — Playwright WebKit 26.6 под Windows (ПК 1280 светлая, iPhone 14 тёмная): всё поддерживается и работает. Настоящий Safari на iPhone/Mac не проверялся; Firefox — без анимации, не проверялся.
- [ ] Локально в WebKit под Windows сессионная cookie `__Host-atlas_session` (Secure) не отправляется по `http://localhost` (Chrome считает localhost безопасным) — для тестов cookie пробрасывалась через перехват запросов. В проде https, проблемы нет. В этом искусственном состоянии (cookie есть, но не уходит) WebKit пишет предупреждение гидратации про `id` флагов на главной; у гостя и в Chrome его нет.
- [ ] Гонка языка: если cookie `atlas-language` и язык в аккаунте расходятся (а `localStorage` пуст), страница показывает то один, то другой язык в зависимости от того, что загрузилось раньше (замечено на тестовом профиле: корзина на ru, заказы на en). В обычной работе `setLocale` пишет оба места, поэтому у клиентов маловероятно; стоит решить, что главнее, и выровнять при входе.
- [ ] Локальный Worker (`npm start`) завершился с кодом 1 с пустой `[ERROR]` после полного `smoke:auth`; после перезапуска `e2e` прошёл. Похоже на сбой wrangler, не продукта.
- [ ] Вычитка текстов уведомлений — на решение владельца: стиль «-lik» в узбекском, знак +/− в «change-requested», формат чисел в en, тексты оператора не переводятся, формулировка частичного возврата в `store-shipping-refund-legacy`.

## Уведомления, язык и тема в шапке, узбекская кириллица — 7 октября 2026

- [ ] Носителю вычитать узбекскую кириллицу на основных экранах: главная, каталог, карточка товара, корзина, заказ по ссылке, заказы, уведомления, кабинет, вход, ошибки и подсказки. Это автоматическая транслитерация латиницы с ручным списком исключений (`lib/market/uz-cyrl.ts`: `stems`, `keepLatin`, `acronyms`, `brandStems`). Сомнительные места: заимствования без ь/я в латинице, которых нет в `stems`; термины («снапшот», «декларация қораламаси»); бренды с окончаниями вне списка `brandStems`. Полная выгрузка слов строится скриптом по словарям (в ветке не сохранён).
- [ ] Подпись «uzb — латиница» из ТЗ реализована как «O‘zbekcha — lotin yozuvi», чтобы оба узбекских варианта назывались одинаково и на своём алфавите. Если владелец хочет буквально «uzb», поменять в `app/header-language.tsx`.
- [ ] Письма, SMS и Telegram-бот для `oz` пока берут тексты через те же словари; рассылка не подключена, поэтому шаблоны внешних сообщений на кириллице не проверены.
- [ ] Старых уведомлений без `code` (до кодированной истории) нет в переводе — они показываются как сохранены, на русском.
- [x] `scripts/smoke-ui.mjs`: шаг «guest order-by-link» искал «без входа» на пустой странице, а с `0db3f0f` подсказка гостю видна только при ссылке. Теперь шаг открывает товар из каталога (`?url=…&catalog=nyx-butter-gloss`, сеть не нужна) и проверяет `.lo-guest`.
- [ ] Локальный Worker (`npm start`) однажды завершился с кодом 1 сразу после ошибки живого импорта `stevemadden.com` без прокси («Магазин убрал карточку товара»). Повторить и выяснить, роняет ли ошибка импорта сам процесс или это сбой wrangler.
- [ ] Встроенный браузер в скрытой панели не завершает анимации выхода Radix Sheet (так же и у карточки товара): закрытие проверялось с отключёнными анимациями. В настоящем браузере проверить вручную.

## Главная, тема, скорость — 7 октября 2026

- Финальная проверка скриншотами на 4K и телефоне в тёмной теме была прервана: стоит пройти глазами после деплоя.
- В Safari и Firefox и на реальных телефонах не проверялось: View Transition для темы есть не везде, где его нет, тема меняется без перехода.
- Шрифты в dev из worktree отдаются с 403 (`@fs` вне разрешённых путей Vite): так только в локальной среде.
- Анимации FAQ-чата на широком экране идут и вне экрана, пока не загрузился декор. Это transform/opacity на композиторе, главный поток не нагружают.

## Логотипы магазинов — 7 октября 2026

- [ ] У большинства магазинов каталога (Mango, Vans, Gap, Sephora, Best Buy и др.) нет марок в Simple Icons: в ленте из них только популярные, и то текстом; на плашках — webp-иконки. Нужны официальные SVG из пресс-китов — по одному и с проверкой условий использования.
- [ ] Без кнопки паузы и без остановки при наведении (решения владельца) ленту можно остановить только фокусом с клавиатуры или «уменьшением движения» (WCAG 2.2.2). Вернуть кнопку, если понадобится соответствие.
- [ ] Декор (`.ambient`, `DeliverySky`) держится на `z-index: -1` в корневом контексте: если предку листа добавить `background`/`transform`/`opacity`/`contain`, фон молча пропадёт. Проверять скриншотом после правок раскладки главной.
- [ ] Не проверено: Safari и Firefox (`mask`, `zoom` у марок ленты, `blur` фона и маски искр), production-сборка, нагрузка анимаций фона на слабых телефонах.
## eBay Browse и косметика — 7 октября 2026

- [ ] Production-доступ к Buy Browse API выдаётся только после одобрения заявки eBay Partner Network («Buy API Application») и тикета в Developer Support; без него прод отвечает `errorId 1100` (пояснение теперь видно администратору в черновике). Подать заявку и после одобрения проверить импорт `/itm/…` в проде.
- [ ] `EBAY_SHIP_TO_POSTAL_CODE` (индекс склада в США) на хостинге не задан — eBay считает доставку продавца по стране без индекса. Добавить индекс склада в переменные при следующем деплое; `EBAY_SHIP_TO_COUNTRY` оставить `US`.
- [ ] Снимок allowlist US-прокси (`supported-store-hosts.json` на UpCloud) переэкспортировать `scripts/export-importer-hosts.mjs` и перезапустить прокси: новые хосты `www2.hm.com`, `arenal.com`, `elfcosmetics.com`, `maccosmetics.com`, `morphe.com`, `charlottetilbury.com`, `api.victoriassecret.com`. До этого они отвечают «временно не отдал данные».
- [ ] Victoria's Secret: адаптер к публичному API написан и покрыт тестом, но вживую не подтверждён — из местной сети Cloudflare отдаёт Node-клиенту 403 (curl с тем же User-Agent — 200), прокси хост пока отклоняет (см. выше). После редеплоя прокси проверить ссылку `/us/…` из прода; если 403 сохранится, остаётся черновик на ручную проверку.
- [ ] Не импортируются кодом (антибот или нет публичных данных): sephora.com и sephora.es, notino.es, bathandbodyworks.com, mifarma/atida, promofarma; perfumerias.com нужен отдельный HTML-адаптер. Импорт честно оставляет черновик на ручную проверку.
- [ ] Charlotte Tilbury: варианты (оттенки) собраны из `siblings` той же модели; проверка корзины перечитывает ту же ссылку, поэтому выбранный оттенок сверяется по SKU. Страницы других стран (`/uk/`) дают цену в GBP — вживую не проверялись.

## Импорт пачкой — 7 октября 2026

- [ ] Shopify ограничивает адрес US-прокси на UpCloud: все Shopify-магазины отдают прокси 429, напрямую — 200. Код делает один прямой повтор из Worker (цена тогда может быть региональной, в черновике есть предупреждение). Правильное решение — второй/ротируемый US-адрес или резидентный выход для `*.myshopify`-магазинов.
- [ ] Zara, Macy's — Akamai, Walmart — PerimeterX, eBay HTML — 403 всегда. Импорт честно сообщает «антибот-проверка (вендор)» и создаёт черновик на ручную проверку; обойти кодом нельзя. Для Zara возможен адаптер к публичному API `/products-details?productIds=`, для Uniqlo — `www.uniqlo.com/us/api/commerce/v5/en/products/<id>` (не делали).
- [ ] eBay Browse в проде отвечал HTTP 400 с неизвестным `errorId`; теперь текст eBay (этап, HTTP, errorId, сообщение) виден администратору прямо в черновике — после следующего прод-импорта `/itm/…` прочитать причину и починить (вероятны: не активирован keyset Production, scope `buy.browse` отсутствует, ссылка с legacy-id). Локально проверить нельзя: ключи только на деплое.
- [x] ~~`www2.hm.com` в JSON allowlist прокси~~ — неактуально с 10.10.2026: H&M не загружается, покупатель вводит данные сам.
- [ ] Батч админа ограничен 25 ссылками за запрос (8 одновременно на сервере, лимит Worker по времени); больше — по частям, остаток остаётся в поле.
- [ ] Не проверено вживую в UI админа (`/admin` → импорт): проверялись сервер, разбор ссылок и импортер тестами и живым прогоном через прод-прокси из Node.
## SEO: что не исправить из кода — 7 октября 2026

- [ ] Хешированные файлы `/_next/static/*` отдаются с `Cache-Control: public, max-age=0, must-revalidate`, хотя vinext кладёт в `dist/client/_headers` правило `max-age=31536000, immutable`: хостинг его не применяет. Каждый повторный визит перепроверяет CSS/JS — хуже LCP. Нужна настройка хостинга или правило кеширования Cloudflare для `/_next/static/*`.
- [ ] `http://atlasmarket.uz/` → `https://` отвечает 302, а не 301 (настройка хостинга/Cloudflare «Always Use HTTPS»).
- [ ] `www.atlasmarket.uz` не резолвится: добавить DNS-запись и 301 на `https://atlasmarket.uz`.
- [ ] Добавить сайт в Google Search Console и Яндекс Вебмастер (способ «мета-тег»: код задать в переменных хостинга `ATLAS_GOOGLE_SITE_VERIFICATION` / `ATLAS_YANDEX_VERIFICATION`, затем деплой) и отправить `sitemap.xml`.
- [ ] Страницы товаров и серверный рендер каталога: сейчас опубликовано 6 товаров, выгода мала, а риск расхождения при гидратации (цены, свежесть по времени) высок — вернуться, когда каталог вырастет.

## Выбор товаров, услуги на посылку, проверка заказа — 7 октября 2026

- [ ] Заявка на услугу посылки висит на первом заказе посылки, с `parcelOrderIds`. Если этот заказ отменят, а остальные останутся, заявку нужно перенести на другой заказ — сейчас она отменится вместе с первым.
- [ ] Посылка = хост магазина + страна. Демо-товары без `sourceUrl` — каждая строка отдельная посылка, у них услуги не объединяются.
- [ ] Не проверено вживую: Safari/Firefox, сенсорный телефон, тёмная тема на шаге проверки (правила Night написаны, скриншота нет); подпись «на всю посылку: AT-…» в `/operations`.
- [x] Решения владельца 7.10: оформление, которое ждёт решения, — только во вкладке «Нужно решение»; счётчики — по оформлениям; последнее событие — только в раскрытой строке; заметки — у каждого варианта свои.

## Сообщения корзины и заказов, избранное — 7 октября 2026

- [ ] Сообщение из аудиозаписи №6 названо не полностью: при просмотре текущего экрана владельцу указать, какой именно текст ещё лишний (проход этого среза убрал повторы, перечисленные в PROJECT_CONTEXT.md).
- [ ] В избранное из корзины можно сохранить только товар из каталога Atlas (избранное хранит id товаров каталога). Строка, добавленная по произвольной ссылке, кнопок «В избранное»/«Отложить» не получает; для неё нужно отдельное решение владельца (например, сохранять ссылку).
- [ ] `npm run smoke:ui` падает на шаге «guest order-by-link»: тест ищет «без входа» на пустой странице, а с PR #24 этот текст показывается только после вставки ссылки. Поправить ожидание в `scripts/smoke-ui.mjs` (было в main до этого среза).
- [ ] Не проверено на реальных устройствах: вход в корзину со счётчиком рядом с кнопкой заказа (iPhone, Android), рамка сохранённой карточки в Safari.

## Корзина: варианты, пошлина, калькулятор таможни — 7 октября 2026

- [ ] Решения владельца по таможне (7.10) реализованы в ветке `feat/customs-owner-decisions` поверх 68f9282 (см. ARCHITECTURE.md). При слиянии с `feat/cart-customs-choice` проверить, что окно калькулятора осталось без таймера и чипов.
- [ ] Заголовок вкладки корзины (`privateMetadata('cart', await pageLocale())`) иногда на другом языке, чем интерфейс (в браузере превью — «Savat»/«Cart» при русском UI). Похоже, сервер берёт язык из cookie/Accept-Language, а клиент — свой. Не связано с таможней, проверить отдельно.
- [x] Услуги «за посылку» у вариантов одного товара начислялись на каждый вариант. Исправлено в ветке `feat/cart-selection-review`: одна заявка на посылку магазина (см. раздел ниже).
- [ ] Группировка вариантов — по `sourceUrl` + `name`: если магазин отдаёт разные цвета по одной ссылке, они тоже попадут в одну группу и получат общие услуги.
- [ ] Не проверено вживую:
  - удержание окна касанием на настоящем телефоне — эмулятор шлёт клики мышью;
  - Safari и Firefox.
- [ ] В карточке «Atlas оплатит таможню» нет обещаний «гарантированно» и «в лучший срок» из голосового: сроками таможни Atlas не управляет. Если владелец хочет формулировку сильнее — согласовать.

## Главная на широких экранах — 7 октября 2026

- [ ] Владельцу вычитать uz-переводы группы `wide` (`lib/market/home-copy.ts`), подписи ленты (`lib/market/home-rail-copy.ts`) и формулировку шага 3 «Как это работает» (`wide.stepCheck`: пересказ 1-го и 5-го пункта «Ваших денег»).
- [ ] Решение владельца: два длинных ответа FAQ, открытые одновременно, делают главу выше экрана (один любой — помещается). Вариант — нативный аккордеон `<details name>`, но атрибут из SSR изменит поведение и на телефонах.
- [ ] Решение владельца: «Как это работает» и «Вопросы» на 27"/4K всё ещё пустоваты; компактная лента 1680–1919 может показаться аскетичной; колонка на 1920 — 1320 px вместо 1360; шага масштаба 1,75 для 4K нет.
- [ ] 2048×1152: медальоны компактные, а не полные (правое поле 300 px, полному по формуле прототипа нужно от ~305 px). Если нужен полный — порог `full>=150` в `app/home-decor.tsx` снизить до 145.
- [ ] Не проверено: Safari и Firefox (CSS `zoom`, `currentCSSZoom`, `getBoundingClientRect` под zoom, `mask`, `color-mix`, WAAPI); шапка вошедшего пользователя и оператора (кошелёк, корзина, «Управление») под zoom на 2560×1440.
- [ ] На production-сборке проверить, что контуры суши (`world-land`) и лента лежат в отдельных чанках и не попадают в чанк главной, и повторить сверку с `main` на 1280×720 / 390×844.
- [ ] Сетка карточек «Как это работает» (subgrid на 4 строки, пример в 4-й) проверена только с dev-плашками вместо списка оплат и пункта выдачи; проверить, когда владелец заполнит `paymentMethods` и `pickupAddress`.
- [ ] Если в самой быстрой группе экспресса две страны и больше (например, админ поставит Великобритании 5–9), список стран в подписи ячейки дней строки фактов обрезается многоточием уже со второй страны. Оговорка «экспресс, от склада» стоит первой и не теряется, полный текст — в `title`; возможно, писать число стран или флаги группы.
- [ ] Стили ленты и декора (`home-wide-rail.css` визуальная часть, `home-wide-decor.css`, ~5,7 КБ gz) грузятся глобально из `app/layout.tsx` и на телефонах. Перенос импорта в ленивые `app/home-rail.tsx` / `app/home-decor.tsx` отложен: в проекте нет CSS-импортов вне `layout.tsx`, порядок каскада сменится (ленивый CSS встанет после `press.css`), а без своего CSS слои декора встанут в поток и удлинят страницу — делать вместе с проверкой чанков в `dist` (`npm run build`).
- [ ] С 1920 номера пунктов ленты приглушены (`opacity: .75`, 3,38:1 на Atlas Day): они `aria-hidden`, имя пункта — подпись рядом (5,78:1). Если владелец захочет строгий AA и для них — убрать приглушение.
- [ ] Night: «Все N магазинов» в финальной карточке — штатная Night-пилюля без мятного акцента (днём мятная, как в прототипе).
- [ ] Подсказки «следующая глава» вставляются порталами последним ребёнком листа: не добавлять условные узлы в конец листов, иначе сместится порядок Tab.
- [ ] Было и до этой работы: на коротких окнах (1920×640, 1680×700 в Night) глава «Ваши деньги» выше окна (696 и 760 px) — лента на это не влияет.

## Заказ по ссылке — 6 октября 2026

- [ ] Решение владельца: стирать черновики заказа по ссылке сразу при выходе из аккаунта (сейчас — при следующем открытии страницы заказа или корзины; до этого они не показываются, но лежат в `localStorage`).
- [ ] Общий компьютер: гость нажал «Войти — товар добавится», не вошёл; если в течение 15 минут на устройстве войдёт другой человек и откроет корзину, товар добавится ему (уведомление называет товар, кнопки «Отменить» нет).
- [ ] Пункта «Заказ по ссылке» нет в меню сайта (есть кнопки в каталоге и на главной) — решение владельца.
- [ ] Не проверены вживую: `err_34` во время входа, две вкладки одновременно, возврат после Google/Telegram, оболочка Capacitor.

## Магазины 2.0 и Каталог 2.0 — 6 октября 2026

- [ ] Визуальная проверка в браузере не выполнялась (срез собран без dev-сервера): `/stores` — hero ≤ 380 px на 375 px, fade-маски рядов с прокруткой, лист диалога 92dvh с липкой кнопкой «Рассчитать», флаги-заглушки с буквами кода; `/catalog` — выравнивание рядов карточек (`.find-store-price`/`.find-total`/`.find-purchase .btn`), баннеры ≤ 56 px, первая карточка на 375 px не ниже ~500 px, Popover разбивки, лист товара снизу; обе темы, 320–1920. Прогнать `npm run smoke:ui` и `scripts/e2e.mjs`.
- [ ] `app/home-chapters.css` (строка ~167: `#finds .find-card .find-photo { aspect-ratio: 1.25 }`) перебивается `!important` в `app/catalog.css` для compact-карточек тизера; убрать правило там, когда файл не правится параллельной сессией.
- [ ] Мёртвые правила после среза: `.stores-overline` (`app/refine.css`), `.find-parcel`/`.find-limit`/`.find-breakdown` (`app/refine.css` 128–134, `app/finds.css`, `app/home-polish.css`, `app/home.css`, `app/dark-theme.css`) — разметки больше нет; вычистить при следующем проходе по CSS.
- [ ] `shortDate` на ru даёт «13 сент» (Intl, `month: 'short'`), в спецификации — «13 сен»; решить, нужен ли свой словарь месяцев.
- [ ] Тестов на `lib/market/store-notes.ts` и группировку каталога по брендам на `/stores` (`BrandCatalog`) нет.
- [ ] Фильтры по цене на `/catalog` работают по `item.costs` (экспресс), а итог на карточке у вошедшего с «обычной» в корзине пересчитывается по этой скорости — возможное расхождение полосы и карточки.
- [ ] Беспошлинный лимит: `catalogAllowance` и строки `/catalog` считают от константы `courierAllowanceUsd`, диалог магазина на `/stores` — от `customsParams(pricing).allowanceUsd` (админский `customsAllowanceUsd`); при переопределении лимита в админке цифры разойдутся — свести к одному источнику в `lib/market/allowance.ts`.
- [ ] `refine.css` (строка ~153) переносит имя магазина на плитке `/stores` на вторую строку (решение владельца «Bloomingd…»); плитки выровнены по высоте ячейки (`height: 100%`), правило ellipsis в `stores.css` убрано.

## Аудит и исправления — 6 октября 2026

- [x] Серьёзные находки аудита перепроверены и исправлены (см. ARCHITECTURE.md, раздел 6 октября «Аудит»); полный список сырых находок — локально `outputs/audit-2026-10-06.md` (не в git).
- [ ] 104 средних и 130 мелких находок аудита не перепроверены; разобрать по `outputs/audit-2026-10-06.md`.
- [ ] Перевести `app/admin-view.tsx` и `app/prelaunch-views.tsx` с полного `GET /api/operations` (до 200 полных документов) на компактные секции.
- [ ] Проверить `?queue=1` на продовой D1 (`json_each`, время сводки); при росте клиентов — колонки-флаги очереди в `market_order_records`.
- [ ] Проекция: заказ, у которого упали и инкрементальная, и полная синхронизация, отстаёт до следующего изменения или «Синхронизировать всё» — нужна периодическая сверка.
- [ ] Отзыв сессий при отвязке сопоставляет способ входа и контакт; надёжнее хранить subject в `market_auth_sessions` (миграция).
- [ ] Юридические документы (`app/legal-documents.tsx`) ещё содержат «предварительный расчёт», «пока не подключены»; менять после решения владельца.
- [ ] CLAUDE.md называет сбор «Atlas оплатит таможню» 3%, в коде с 5.10 — 4,98% (`customsHelpShare`); сверить с владельцем и поправить документ.

## Мобильные приложения, Apple, удаление аккаунта и согласия — 6 октября 2026

- [x] Оболочка Capacitor 8.5.2 в `mobile/` (android/, ios/ через SPM, www/ с офлайн-страницей, иконки и splash через `npm run assets`); `tsconfig`/eslint исключают `mobile`.
- [x] Мост `lib/native/bridge.ts`, шелл `app/native-shell.tsx` и `app/native.css`; разбор ссылок `lib/native/links.ts`; маршруты `/.well-known/apple-app-site-association` и `assetlinks.json` (404 без env).
- [x] Вход через Apple: веб (`form_post`, cookie `__Host-atlas_apple` SameSite=None) и нативный iOS; refresh-токены в `market_auth_tokens` (миграция 0010), отзыв при удалении аккаунта с отчётом о неудаче в `market_operational_errors`.
- [x] Handoff из системного браузера в приложение только с PKCE (`lib/native/pkce.ts`, `POST /api/auth/handoff {code, verifier}`); `/auth/return` в `reservedPaths`.
- [x] Аккаунты проверяющих `ATLAS_REVIEW_ACCOUNTS` (фиксированный код по почте, без отправки).
- [x] Удаление аккаунта: `POST /api/account/delete`, диалог в кабинете, `/delete-account`; псевдоним — HMAC под `ATLAS_AUTH_SECRET`; `err_41`–`err_44`.
- [x] Согласия: `State.consents`, действие `consent-accept`, запись в `market_legal_consents`, плашка-гейт `app/storage-notice.tsx` (запись только по клику).
- [x] Публичные страницы `/privacy`, `/terms`, `/support`, `/delete-account`, `/app`; новые разделы оферты (11) и политики; sitemap/robots/llms; футер и карточка «Настройки» в кабинете.
- [x] `android:allowBackup="false"`; абзац о возрастном рейтинге в `MOBILE.md` §3; блокер контактов в `MOBILE.md` §6.
- [ ] Прод: применить `drizzle/0010_apple_auth.sql` к рабочей D1 (без таблицы вход через Apple работает, но токены не сохраняются и не отзываются).
- [ ] Владелец: Apple Developer Program — Team ID, App ID `uz.atlasmarket.app` (Sign in with Apple, Associated Domains), Services ID с return URL `https://atlasmarket.uz/api/auth/apple/callback`, ключ `.p8`; задать `APPLE_SERVICES_ID`, `APPLE_APP_BUNDLE_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` в Sites; зарегистрировать домен и адрес отправителя в «Sign in with Apple for Email Communication» (AUTH_SETUP.md §7).
- [ ] Владелец: Google Play Console — приложение `uz.atlasmarket.app`, Play App Signing, SHA-256 upload- и signing-ключей → `ANDROID_CERT_SHA256`, `ANDROID_PACKAGE_NAME`; upload keystore хранить в `secrets/`.
- [ ] Владелец: задать `ATLAS_REVIEW_ACCOUNTS` и Review Notes по шаблону `MOBILE.md` §3; удалить переменную после одобрения.
- [ ] Владелец: скриншоты, описания RU/UZ/EN, ответы App Privacy / Data safety (согласованы с `/privacy`), URL политики/поддержки/удаления/условий при подаче.
- [ ] Владелец: заполнить `siteContent.contacts` (минимум `supportEmail`), `siteContent.apps` после публикации и реквизиты юрлица — блокер подачи (`MOBILE.md` §6, п. 0).
- [ ] Юрист: проверить раздел 11 оферты и новые разделы политики (приложения, ИИ/OCR, вход через провайдеров, удаление, согласие, возраст); подтвердить текст согласия и `consentVersion='2026-10-06'`; решить, нужны ли переводы тел документов на uz/en (сейчас на `/privacy`, `/terms` локализована только шапка).
- [ ] Владелец: возрастной рейтинг — документы определяют сервис как для совершеннолетних: 17+ в App Store, 18+ по IARC в Google Play (`MOBILE.md` §3).
- [ ] Бухгалтер: срок хранения обезличенных записей о заказах и бухгалтерии после удаления аккаунта (в UI срок не называется).
- [ ] Сборка iOS только на macOS с Xcode 16+: проверить компиляцию `@capacitor-community/apple-sign-in` 7.1.0 под Capacitor 8 и автоподхват `App.entitlements`; iOS-проект сгенерирован на Windows и проверен только текстово.
- [ ] Android: сборка Gradle не запускалась (нет Android Studio/SDK в сессии); прогнать чек-лист релиза `MOBILE.md` §6.
- [ ] Живые потоки Apple не проверялись (нет ключей): `form_post`, обмен кода, отзыв токена, системное окно iOS, вариант «Скрыть почту», cookie SameSite=None в Safari/Chrome, привязка Apple в кабинете.
- [ ] Удаление аккаунта и плашка согласия не прогонялись вживую против D1/R2 и в браузере — только юнит-тесты, eslint и tsc; проверить в реальных сборках iOS/Android (строки «Восстановить покупки» и «О приложении» видны только при `isNative()`).
- [ ] `npm run build` в спринте не запускался: проверить сборку маршрутов с точкой в имени каталога (`app/.well-known/*`); при отказе `assetlinks.json` можно отдать статикой из `public/.well-known/`, AASA требует маршрута.
- [ ] Визуально проверить новые страницы и карточку «Настройки» (Day/Night, 375–1920 px); Night-правила для `.cabinet-danger`/`.delete-account` опираются на токены `customer.css`, отдельных правил в `theme-night.css` нет.
- [ ] Оператору следить за строками «Apple token revocation failed» в `market_operational_errors` (area `auth`) и повторять отзыв; политика обещает именно это.
- [ ] Локализовать код ошибки `handoff_invalid` в копии `/login` (сейчас шелл показывает общий тост о неудачном возврате).
- [ ] Запланировано, не реализовано: push-уведомления (APNs/FCM), биометрическая блокировка, приём ссылок через системный share; кнопка «Открыть настройки аккаунта» на `/delete-account` ведёт на `/account` без якоря.
- [ ] Риск Apple 4.2 («просто обёртка») остаётся: список смягчений — `MOBILE.md` §7.

## 6 октября 2026 (вечер): тарифы экспресс/обычная, группировка заказов, роли, бухгалтерия

- [x] Слито с main #18: `pricingRevision` = 5 (экспресс $15,98 вместо $14,98 из main, обычная $13,98), остальные решения main сохранены.
- [x] Две скорости доставки: экспресс $15,98/кг (5–9 рабочих дней из США, 7–9 из остальных стран) и обычная $13,98/кг (9–14), переключатель в корзине и в расчёте по ссылке; `pricingRevision = 3` (комиссия ровно 9,98 %, `buyoutFee`/`conversionFee` → 0).
- [x] Решение владельца: скорость по умолчанию — экспресс (`defaultDeliverySpeed`); старые заказы без `quote.deliverySpeed` читаются как экспресс.
- [x] «Сроки и тарифы» на главной — карточки стран с SVG-флагами и обеими скоростями; первый рендер с серверным тарифом, числа не «прыгают».
- [x] «Мои заказы» сгруппированы по оформлению и магазинам; клиентская кнопка «Отменить заказ» убрана (отмена только оператором).
- [x] Роли сотрудников (`admin`/`finance`/`support`/`procurement`/`warehouse`) дают права с серверной проверкой; `/api/finance`, `/operations` и `/analytics` переведены на права.
- [x] Бухгалтерия: годовая таблица и кварталы, маржа по заказам, закрытие периода, обязательства, курсы для записей, исправление записи, спарклайны.
- [ ] Курсы EUR/GBP/CNY/RUB для записей журнала вводятся владельцем вручную в Администрирование → Финансы (источника курсов нет); USD берётся из тарифа.
- [ ] Сузить данные `GET /api/operations` для ролей `support` и `warehouse`: аккаунты сейчас отдаются целиком (адреса, телефоны), хотя секции справочника/аудита/ошибок уже скрыты по правам.
- [ ] Визуально проверить новые экраны на 375 px и в тёмной теме (`npm run e2e` после сборки): переключатель скорости в корзине и в расчёте по ссылке, карточки тарифов на главной, группы заказов на `/orders`, бухгалтерия (таблицы в `.acc-scroll`), «таблетка» активного пункта меню (контраст `--night-jade` на rgba .14), перенос ссылок футера на ПК, `/admin` под ролью `support` (видны только Обзор/Клиенты/Поддержка). Сборка, smoke и e2e в спринте не запускались.
- [ ] Удалить мёртвый CSS старой таблицы тарифов и расчёта: `.home-tariffs*`, `.home-table-wrap`, `.days-bar`, `.home-tariff-price`, `.calc-fx`, `#tariffs > .calc-fx` в `app/home.css`, `app/day-folio.css`, `app/theme-night.css`, `app/customer.css`, блок `#tariffs .home-tariffs` при ≤760px в `app/home-chapters.css` (отчёт `node scripts/css-unused.mjs`; там же `.home-step-icon`, `.home-trust-points`, `.checkout-optional`, `.calc-customs-*`).
- [ ] Поиск и пагинация журнала — на клиенте (сервер отдаёт до 5000 записей за месяц); при >5000 записей перенести на сервер. Балансы клиентов для обязательств считаются перебором `market_accounts` (LIMIT 5000).
- [ ] Прод: миграций нет; старые заказы попадут в заказы месяца бухгалтерии после «Синхронизировать всё» (проекция `market_order_finance`); после публикации задать ставку налога и при необходимости курсы для журнала.
- [ ] Коды ошибок `err_28`/`err_29` («Доступ только администратору») маршрутами больше не используются (теперь `err_50`); тексты в `lib/market/i18n.ts` удалить при следующей чистке.
- [ ] Сотрудник с ролью `admin` в справочнике может отключить сам себя — ожидаемо, но стоит подтвердить у владельца; основной администратор из `ATLAS_OPERATOR_EMAIL` не изменяем.
- [ ] Опционально: экспортировать `parsePricingValue` из `lib/market/server.ts`, чтобы `lib/market/pricing-equal.ts` не дублировал его логику; строка «Доставка: экспресс/обычная» есть только в клиентской карточке заказа, в операторской — при необходимости.

## 6 октября 2026 (вечер), вторая волна: автоматизация бухгалтерии, админка, контент сайта

- [x] Автопроводки `AUTO-…` из проекции заказа (оплата, оплата балансом, выкуп, доставка магазина, пошлина, возвраты на баланс), сверка `?check=1`, денежная позиция, налоговый календарь-ориентир, `fx` в ответе, полная книга месяца и JSON-бэкап, импорт выписки с отдельным подтверждением, счёт-расчёт `?invoice=` (не фискальный документ).
- [x] Бухгалтерия разбита на вкладки (`app/accounting-*.tsx`), админка — на `app/admin-*.tsx` с серверным дашбордом, карточкой клиента, заметками, фильтруемым журналом и статусом системы; контент сайта редактируется из вкладки «Контент сайта» и хранится в D1.
- [ ] Миграция `drizzle/0011_admin_customer_notes.sql`: запись в `drizzle/meta/_journal.json` добавлена вручную (после слияния с feat/mobile-store — idx 11 после 0010_apple_auth, tag `0011_admin_customer_notes`), снапшота `drizzle/meta/0011_snapshot.json` нет, номер 0010 пропущен — при следующем `npm run db:generate` сверить, что drizzle-kit не создаёт `market_customer_notes` повторно.
- [ ] Прод: применить 0011 к продакшен-D1 при деплое (локально применена). После деплоя выполнить «Пересобрать проекцию» в `/admin` — это создаст автозаписи для существующих заказов; попавшие в закрытые месяцы окажутся в `accounting.auto-skipped` и в сверке. Затем проверить в браузере, что `GET ?month=&check=1` отдаёт `reconcile`/`fx`/`cash`, `?year=` — `taxCalendar`, `?invoice=` — `{invoice}` и 404 для неизвестного заказа.
- [ ] `app/order-workspace.tsx` в двух местах по-прежнему проверяет `user?.operator` (ссылка на операторский вид и блок после заказов), а не права через `hasPermission`; `app/prelaunch-views.tsx` уже переведён. Проверить и перевести на `permissions`.
- [ ] Вопрос владельцу: `cancelOrder` в `lib/market/domain.ts` зачисляет на баланс `quote.total` даже у неоплаченного заказа; автопроводки считают только фактически полученное (`payment.amount` + `balanceUsed`), поэтому книги и баланс клиента могут разойтись. Решить, менять ли домен.
- [ ] Производительность: `syncAutoLedger` выполняется при каждой записи операционной проекции (2 SELECT + batch при изменениях). При росте нагрузки вынести в фоновую очередь или ограничить заказами, изменившимися с прошлой ревизии.
- [ ] `closings` в ответе `GET /api/finance?month=` движок пока не отдаёт; UI читает его через `normalizeClosings` и показывает ссылку на аудит вместо «Истории закрытий». Движку — добавить последние события `accounting.lock`/`accounting.unlock` в ответ.
- [ ] `bank-confirm` принимает только `customer_payment` с `orderId`; расходы из выписки записываются через `entry` (id `LED-`, без пометки «выписка»). Если нужно помечать их `BANK-`, расширить `bank-confirm` или добавить `source` в `entry`. Проверить, что заголовки дебет/кредит и запятые в CSV не ломают серверный разбор `bank-import`.
- [ ] Фото посылок в контенте сайта — только путь из `public/`, кладутся в репозиторий вручную; загрузки в R2 из админки нет.
- [ ] Вкладка «Система» показывает только дату и число записей последнего бэкапа: размер файла в `market_backup_exports` не хранится. Переключателя техрежима нет (механизм не реализован).
- [ ] Визуально проверить `/admin` на 375/393/1280 px в обеих темах (`npm run e2e` после сборки): вкладки `.admin-tabs-icons` с отрицательными полями, таблицы `.admin-grid` в `.admin-scroll`, модалка карточки клиента, контраст `.admin-tab-count`/`.admin-count`; бухгалтерия — карточки `.acc-cards-on-phone`, вкладки `.acc-tabs`, бейджи `acc-badge-warn`/`acc-badge-error`, печать счёта (Ctrl+P — только лист); форма контента (`fieldset.catalog-editor` без рамки сверху — добавить правило для `.site-content-admin .catalog-editor`). Сборка, smoke, e2e и браузер во второй волне не запускались.
- [ ] При желании: тест в `tests/access.test.mjs`, что `content.manage` есть только у `admin`; список валют формы записи (`currencies` в `app/accounting-shared.tsx`) можно строить из `fx.rates`.
## Tariff r4, link-order sheets, swipe gallery, Telegram bot sign-in — 6 October 2026

- [x] Tariff revision 4: $14.98 per kg everywhere and the fee exactly 9.98% (a saved buyout/conversion percent made it 10.98%); per-country per-kg and fee overrides are dropped once.
- [x] Link order: the grey "set by Atlas" note is gone. The snapping sheets were removed the same day: the magnet made choosing a size hard.
- [x] Product photos slide with the finger and settle one at a time (all galleries); arrows, thumbnails, keys and a mouse drag animate.
- [x] Sideways chip and card rows settle on a card edge; the catalog snaps only at its top and its footer.
- [x] Capital letters while typing: every word in names, the first letter in city and address.
- [x] Sign-in through the Telegram bot (one tap opens the app, confirm in the chat, the page signs in); `/login` shows Telegram first and the other methods as a column of buttons.
- [x] The published site (atlasmarket.uz over https) connects the bot webhook by itself on the first sign-in page load; "Подключить бота" in Admin → System does it by hand. Until it is connected the old widget stays. Reconnect after changing the site address, `TELEGRAM_BOT_TOKEN` or `ATLAS_AUTH_SECRET` (the webhook secret is derived from both).
- [x] The bot's first message after Start is the welcome animation (`public/telegram/atlas-welcome.mp4`, 960×540, 5 s loop) with the text and the confirm button as its caption; its Telegram file_id is cached in `market_settings` (`telegram-bot-animation`); on any failure the bot forgets it and sends the text alone.
- [ ] Real-device check of the bot sign-in: iPhone and Android with Telegram installed (t.me opens the app), Telegram Desktop on Windows/macOS (tg:// opens it), and a computer without Telegram (the "open in the browser" link).
- [ ] The bot asks for one confirm tap after Start (protects against someone sending a sign-in link to another person); if the owner wants zero taps, that protection is lost.
- [ ] The catalog magnet is checked in Chromium only; check iPhone Safari (the measured bottom bars, the keyboard over the sheets).

## Home sheets — 5 October 2026

- [x] The home page is a stack of full-screen sheets on the root scroller: mandatory snap where sheets fit, proximity on windows 700px tall or less, none under reduced motion.
- [x] Phones: the example bill, the money facts and the order tracking are sheets of their own; the "Вставить ссылку" dock sits on the bottom bar; rates are 2-column tiles.
- [x] Closing card and footer form one end sheet; the FAQ title is no longer sticky; anchors re-scroll once after the teaser loads.
- [x] Teaser: all 8 cards in one swipeable row, ‹ › buttons from 761px.
- [ ] Physical iPhone Safari check: lvh vs svh with the toolbars in and out, mandatory vs proximity, a sideways swipe on the teaser row against the vertical snap, the on-screen keyboard over the dock when the hero input is focused.
- [ ] Mac trackpad check in Safari and Chrome (momentum flicks, small drags snapping back).
- [ ] Windows mouse-wheel check: if one 100px notch snaps back instead of moving a sheet, enable the commented `(hover:hover) and (pointer:fine)` proximity fallback in `app/home-chapters.css`. Headless Chromium treats synthetic wheel deltas like a trackpad (100px snaps back; 0.6 of the screen moves one sheet), so this needs real hardware.
- [ ] UZ/EN copy fit at 375×812 on real devices (measured in Chromium: fits; the bill sheet in Uzbek with Atlas Night needs 659 of 683px, so its padding is 10px on short phones).
- [ ] Atlas Night screenshots of every sheet for the owner (dark was measured and fits, but its hero and tracking card are taller; on wide windows ≤860px tall the Night hero title is capped at `clamp(40px,6.4svh,56px)`).
- [ ] Re-snap after a language switch and after closing the product dialog (sheet heights change with the copy; the page may rest between two sheets until the next scroll).
- [ ] Owner decisions from the spec: one desktop row of 4 cards instead of two visible rows; footer-only last sheet on phones; the sparse phone tracking sheet (merge with the money facts until reviews and photos exist?); mandatory vs proximity on desktop; the airy desktop How-it-works sheet.

## Simpler bill and customs paid through Atlas — 5 October 2026

- [x] No international reserve in the bill (tariff revision 3); weighing refunds the difference or asks for consent.
- [x] Customs block: no duty up to $200 a month per recipient, including purchases outside Atlas; duty estimate when over.
- [x] "Atlas pays customs for me": 4.98% of the goods price (no delivery), in the bill at once, counted as service income; the estimated duty is prepaid in the order, the rest returns to the balance and a higher duty needs consent before delivery.
- [x] Unknown store delivery above $50 shows 0 in the link-order field.
- [x] "Оформить заказ" opens the new order in My orders.
- [ ] The duty estimate is the value-based lower bound (20% of the part above the allowance); the $2/kg minimum can make customs charge more, which then needs the customer's approval. Consider prepaying the higher of the two once parcel weights are reliable.
- [ ] An approved duty extra (like an approved store-delivery extra) is recorded on the order but not added to `orderPayable`; collect it once a payment provider is connected.
- [ ] The books keep the prepaid duty inside `payable` only; add a transit column for duty if the accountant needs it separately.
- [ ] Without the reserve, a parcel heavier than estimated needs the customer's approval of the extra before it ships; watch how often weighing asks for more.
- [ ] Connect a payment provider and redirect to its page between checkout and My orders; until then payment stays simulated.
- [ ] The "already over the limit outside Atlas" checkbox is hidden; if the owner wants it back, it is still supported by `cartCustoms.outsideUsed`.

## Security audit, stage 1 — 5 October 2026

- [x] Removed the `import-legacy` action (a customer could write their own balance, paid orders and staff fields).
- [x] Rate limits on `/api/actions` (60 a minute; 40 store checks per 10 minutes) and passport uploads (20 a day per account).
- [x] Order numbers have 12 hex digits; the operational tables and books never overwrite another customer's order with the same number.
- [x] `X-Frame-Options: DENY` while the CSP is report-only.
- [x] Administration → Система warns when `ATLAS_AUTH_SECRET` is not set.
- [ ] Enforce the CSP (now report-only) once nonces replace the inline scripts; then `frame-ancestors` takes over from `X-Frame-Options`.
- [ ] `/api/actions` still returns the text of internal exceptions to the customer as a 400 message; map them to stable codes.
- [x] Staff roles in `market_staff_directory` grant nothing: only `ATLAS_OPERATOR_EMAIL` is an operator. — Сделано 6 октября 2026: роли дают права с серверной проверкой (`lib/market/access.ts`, `STAFF_ROLES.md`).
- [ ] `payment-demo` lets a customer mark their own order paid, and the books count it as paid; remove it when a payment provider is connected.
- [ ] Rate limits use fixed windows in D1; repeated sign-ins on the local Worker reach them (reset: `DELETE FROM market_rate_limits` in the local D1 only).

## Accounting, customs, discounts, OCR, delivery days — 6 October 2026

- [x] Books: order finance split (transit vs Atlas income), money ledger with voids, monthly profit and profit tax, three CSV exports for Excel (Admin → Финансы → Бухгалтерия).
- [ ] Before publishing: apply migrations `0008_auth_links` and `0009_accounting` to production D1 (without 0009 the books are empty and adding entries fails; everything else works).
- [ ] Owner + accountant: confirm the profit tax rate (default 15%) and that Atlas books goods as an agent (transit). If the contract makes Atlas the seller, the goods become revenue and cost of goods, and the model in `lib/market/finance.ts` changes.
- [ ] Operators: record real costs in the ledger (carrier invoices, payment and bank fees, payments to stores); until then profit equals income.
- [ ] Payments are still simulated: "paid" orders in the books are test marks until a payment provider is connected.
- [x] Customs choices at checkout (limit already used outside Atlas, help paying customs at 3% of the goods value); compact customs block in the cart.
- [x] Store discount (crossed "before" price and −N%) on the order page, in the cart and the product sheet; Shopify compare-at prices are imported.
- [x] Passport and Uzbek ID card OCR in the browser (Tesseract.js from /ocr/, TD1 + TD3 with check digits); HEIC photos converted to JPEG.
- [ ] Check OCR on real photos of an Uzbek ID card back and a passport page; names from OCR may need correction (the customer reviews every field).
- [x] Delivery days per country editable in the admin (Тарифы); the rate line and extra footnotes removed from bills.

## Atlas Day — 5 October 2026

- [x] Light theme: bill as a folio (white sheet in a light mint folder, cream slip for what is outside the amount to pay) on the home example, link order, cart and cabinet; white cards with shadows; Inter only; the brand green for actions, light accents only on the discount pill, top deals and good news (a brighter emerald everywhere read as "acid"); no all-caps labels.
- [x] Owner feedback the same day: Piazzolla removed (its digits read badly), then Manrope replaced by Inter across the site (long soum amounts looked uneven; the wordmark keeps Manrope), the previous catalog card restored (−N% pill, gold top-deal badge, green total, filled Order button), the rates table shows each country's own price, the desktop cart summary is one compact sticky card aligned with the items.
- [ ] Before publishing: apply migration `0008_auth_links` to production D1 (sign-in works without it, but attaching methods in the cabinet answers "unavailable"), then set the provider keys from `AUTH_SETUP.md`.
- [x] Sign-in no longer drops: transient errors keep the account on screen, sessions slide to 60 days from the last visit, www redirects to the main host, Eskiz re-signs in on a revoked token; Telegram, phone, email and Google can be attached to one account in the cabinet.
- [x] Layout check across current iPhone widths (375–440) and 1280–1920: operator header overflow, header edges vs content, phone rates table fixed; e2e keeps checking overflow, clipped text, card rows and missing spaces.
- [x] Buttons with a gradient, top highlight and shadow like in Night; one spacing rhythm in the catalog card; the reassurance list under "Оформить заказ" removed from the cart.
- [x] Postal code is required (six digits) for new and edited recipients and at checkout; a recipient saved without one is asked once at checkout and updated.
- [x] Fixed on screen: the example fee showed "10%" (now 9.98%), the example ignored the 0.3 kg packaging, the home FAQ and the customs page quoted different rates (the FAQ now points to the customs page, which explains the PP-4508 / UP-174 date conflict like the calculator), stretched store-filter logos, the "доступны только вам" overclaim.
- [ ] Owner: fill `lib/market/site-content.ts` (contacts, legal entity and INN, pickup address, payment methods). Until then the contacts column and the legal card are not shown; nothing must be invented in their place.
- [ ] Owner decision: rename "Возвратный резерв" to a plainer name ("Запас на вес посылки"?) on every screen at once, or keep it.
- [ ] Owner decision: order the home teaser toward $30–150 items, so the first cards are not $3 lip gloss priced mostly by the 1 kg minimum.
- [ ] Do not claim that passport access is logged until `app/api/passport/route.ts` writes an audit event for staff reads.
- [ ] Operators: there is no postal-code lookup; a six-digit code is checked for shape only. Recipients saved before 5 October 2026 may still have no code until their next order.

## Order calculation — 5 October 2026

- [x] 0.3 kg packaging once per parcel; weight from the store or an editable, labelled estimate.
- [x] 9.98% Atlas fee on merchandise only; CBU USD rate × 1.012 with the rate and time shown.
- [x] Unknown store delivery: free strictly above $50 from a store, else a hold outside the amount to pay.
- [x] Several options with quantities, eBay stock, order comments, customs per recipient with outside use and the help request, passport notices, faster service actions.
- [ ] Confirm the customs rate start date with Customs (PP-4508 consolidated 01.09.2026 vs UP-174 §8 01.01.2027) and set `customsRate`/`customsMinimumPerKg` in the tariff form if needed.
- [ ] The allowance month is the month of import; Atlas has no customs date and uses the delivery month (or the current month while in transit). Record the real customs clearance date when the carrier provides it.
- [ ] Payments are simulated: the passport notice speaks of a placed request. When a real provider confirms payment, show the notice only for paid orders and say so.
- [ ] Stock is known only for eBay (Browse API estimate). Shopify `/products/*.js` exposes only availability; do not infer counts from cart-limit errors.
- [x] A store-stated delivery charge stays a charge even above $50; "free above $50" applies only to unknown delivery (confirmed by the owner, 5 October 2026).
- [ ] After deploy: check that the Worker can reach `cbu.uz` from Sites; if not, switch the tariff to a set rate.
## Checkout and form controls — 4 October 2026

- [x] The checkout phone field turned "9" into "99 89" and could not be erased; it now keeps the caret and handles deleting, pasting and a tenth digit.
- [x] Ticked checkboxes were barely visible in the dark theme and on phones set to dark mode; a ticked row is highlighted as a whole.
- [x] The recipient step showed every address field under an already chosen recipient; the cart showed the total and the button twice.
- [x] Sideways scrolling at 320 px on every page.
- [ ] The price check before checkout takes 10–20 s for Amazon from the workstation; check the time on production (through the proxy) and consider checking in the background when the cart opens.
- [ ] The catalog's first phone screen is mostly the lead and two banners (duty-free, parcel); consider folding them.
## Delivery tariff — 4 October 2026

- [x] Delivery is $15 per kg ($1.5 per 100 g) at the Atlas rate; the home page lists express times for the US, the UK, China, Germany, Italy and Spain.
- [ ] After deploy, open Administration → tariffs once: check `fx`, the $15 rate and "Rates by actual dispatch country" (an old soum override there still wins for its country), then save so the row stores `perKgUsd`.
- [ ] Confirm with the carrier whether the times run from the warehouse abroad (the copy says so) and whether they bill in 100 g steps; Atlas rounds the parcel up to 10 g.
- [ ] Turkey, France, Romania, Japan, Korea and other countries are not in the owner's route list but are still quoted at the base $15. Decide whether to block them or set their own rates.
## Price check with the stores and cart — 4 October 2026

- [x] A refused action showed "could not save" instead of the reason (for example "the price changed"); the server's text now reaches the customer.
- [x] A changed store price at checkout no longer dead-ends: the cart takes the new price, marks the line and shows the new total; the customer checks out again.
- [x] Quotes made before an operator changed the tariff are repriced and shown again instead of passing within their 15 minutes.
- [x] Store delivery stated on the product page is compared too; Atlas's editable reserve is not.
- [x] "Check out" checks prices with the stores first; quick quantity taps are no longer dropped.
- [x] `persist()` refuses a document that would not parse on the next read.
- [ ] Production check after deploy: one product per proxy-dependent store (Nike, Target, Walmart, Merrell) through `npm run importer:check` on the UpCloud host, and a cart-check from a phone; locally those stores time out without the proxy.
- [ ] An unreachable store is accepted at checkout when the price was confirmed in the last 30 minutes (the order history says so and the operator re-checks before buyout). If operators prefer a hard stop, set `unreachableGraceMs` in `lib/market/cart-check.ts` to 0.
- [ ] The price-change mark stays on a cart line until checkout or removal; there is no "dismiss".
## Store-delivery reserve, light theme, phone scale and stores — 4 October 2026

- [x] Unknown store delivery: one $10 reserve per store order instead of per line × quantity, none from $50 of items from that store (pricing setting `storeShippingFreeFromUsd`); the cart says how much more removes it; "no reserve" instead of "free".
- [x] Removing a cart line reprices the rest of the cart (parcel shares and the reserve were left stale).
- [x] Light theme follows one palette (Atlas Day); phones get a 60 px header, smaller titles and chips; catalog totals and "+N to your parcel" no longer leave the card at 320–390 px.
- [x] `/stores`: collapsed type shelves with "show all", "Stores you ordered from", catalog counts on tiles, similar stores in the store card, "Store not listed?".
- [ ] Carts saved before this change keep their old reserve until the quote is renewed (15 minutes at most) — no migration needed, but a cart open at release time may show the reserve hint and the old line together until "Refresh estimate".
- [ ] Operators should know that waived-reserve orders still need "confirm store shipping" (actual $0 when the store shipped free) before buyout, as before.
- [ ] Atlas Day was checked on the main customer pages (home, catalog, stores, cart, account, orders) and by the e2e snapshots; operator pages (`/admin`, `/operations`) only by the automated contrast audit.
## Stores, logos and phones — 4 October 2026

- [x] `/stores`: 207 brands instead of 266 lowercase domains, proper names, logos, types and storefront countries, search and filters in the address, a store card with country storefronts, catalog products and iPhone copy instructions, a link field with paste.
- [x] Phones: a bottom bar for guests too (they had no navigation and no sign-in on phones), brand colours instead of the old blue, safe areas, no tap flash or stuck hover, 24 px checkboxes, compact "How it works" and footer.
- [x] e2e fails on phone text fields under 16 px (iPhone zoom) and controls under 24×24 px.
- [ ] Logos missing for Aéropostale, Carrefour, Converse, Druni, END., Gap, Reserved and Springfield (monograms shown); GOAT's icon was rejected. Re-run `node --experimental-strip-types scripts/store-logos.mjs` after adding stores.
- [ ] Storefront countries for `.com` sites are the brand's main market; multi-country `.com` sites (Zara, H&M, UNIQLO) actually depend on the visitor's region. The US egress proxy sees the US version.
- [ ] Checked in Chrome's phone emulation and against Safari-specific CSS, not on a physical iPhone: open the site on one (Safari and "Add to Home Screen") before launch.
- [ ] `scripts/audit-ui.mjs` also still expects the old store directory markup.
## Catalog and filters — 4 October 2026

The public catalog had 6 products, so the home section (shown from 8) never appeared; filters were hidden below 16 products, lived only in component state and did not separate real data (every product ships from the US; budget steps of 1–2 million soum against products of 275–500 thousand).

- [x] `/catalog` page with filters in the address (category, store, delivered price, size, duty-free, on sale, current price, sort, collection), counts next to every option, a filter sheet on phones and a sidebar from 1024 px, two cards per row on phones; the home page shows a teaser from 4 products.
- [x] Duty-free awareness: the remaining $200 allowance of the primary recipient this month, a filter that uses it and a mark on cards above it.
- [x] "With your parcel": for stores already in the cart, cards show what the product would add to the cart total (priced by `repriceCart`).
- [x] Empty results suggest which single filter to drop; the catalog ends with "order by link" and the store directory.
- [ ] Product cards are rendered on the client after `/api/catalog`; the server HTML of `/catalog` has the heading, filters and placeholders but no product names. Server-rendering the first page of products would help search engines.
- [x] The unconfirmed store-shipping reserve ($10) was charged per cart line; since 4 October 2026 it is one per store order and waived from $50 (see the section above).
- [ ] The allowance follows the primary recipient; a recipient switcher in the catalog would help households that order for several people.
- [ ] Sizes come from the store's own size list. US stores mix systems (men's/women's, "US 9" and "9"); "US " is normalized, but there is no conversion to EU/UZ sizes yet.
- [ ] `scripts/audit-ui.mjs` (not run in CI) still expects the old home catalog and the pre-#8 guest order link; `npm run e2e` covers the same ground. Update or remove it.
- [ ] The live catalog in production has 6 products, 4 of them waiting for a price check: the catalog becomes useful only once operators publish more items (Administration → Catalog).
## Post-merge review and polish — 3 October 2026

Checked `main` at `fedd1e7` (the squash of #8), then fixed the findings on `fix/post-merge-polish`. lint, `tsc --noEmit`, all tests, the build, `smoke:ui`, `smoke:auth` (live import skipped locally) and `npm run e2e` pass; the e2e audit covers customer, guest and operator pages at 390 and 1280 px in both themes.

- [x] Unknown URLs render a localized `app/not-found.tsx` inside the site shell, still with HTTP 404.
- [x] `<title>` and description follow the rendered language on every page; private pages have localized titles instead of one generic title.
- [x] `/customs` and `/legal` render their text in place in the server HTML (each page now passes its view to the shell; no hidden Suspense copy, duplicated `h1` or ids).
- [x] `/analytics` light theme: the attention card keeps its dark background (`.surface.attention-report`).
- [x] Security headers from the Worker (`next.config.ts`): `nosniff`, referrer policy, `Permissions-Policy`, HSTS; CSP and `frame-ancestors` report-only, with reports in the operator error log.
- [ ] Enforce the CSP (switch to `Content-Security-Policy`) once production shows no unexpected `csp` reports under Administration → System; first confirm that nothing legitimate (for example a Sites dashboard preview) frames the site.
- [x] Contrast reaches WCAG AA in both themes (`--night-faint` raised to `#88938d`, light-theme floor in `customer.css`); the dark header favourites icon; 24 px tap targets for breadcrumbs and text links; long store names wrap on phones.
- [ ] `/legal` still shows "Заполнить до запуска" in eight places and the documents exist only in Russian: needs the company details and a reviewed Uzbek version.
- [x] `smoke:ui` follows the redesigned home (and checks the 404 page); `smoke:auth` skips the live import with `ATLAS_SMOKE_SKIP_LIVE_IMPORT=1` and says so.
- [x] Page weight: each route loads only its own view, and unused selectors are removed (`scripts/css-unused.mjs`). Stylesheet 500 → 421 KB (84 → 71 KB gzip); shared JS on private pages 257 → 186 KB gzip.
- [ ] The home page still loads about 258 KB gzip of JS, and every page parses the shared runtime again on each full-page navigation. Next steps: native `<dialog>` instead of Radix in `Modal`/`Sheet` (most of the `market-ui` chunk), keep zod schemas out of the client provider, and revisit client-side navigation once Vinext's prefetch issue is fixed.
- [x] App icons, web manifest and `theme-color`; `robots.txt` without the ChatGPT sign-in paths; sitemap and `llms.txt` list the language versions.
- [x] #5 and #7 closed with a note (their changes reached `main` through #8).
- [ ] Apply migration `0007_web_vitals` to production D1; until then beacons are dropped quietly and the speed summary says it is unavailable.

## Premium dark theme and typography — 3 October 2026

- [x] One dark palette ("Atlas Night": black-green canvas, ivory primary actions, jade accents, champagne labels) in `app/theme-night.css`, loaded last. The dark theme had three stacked generations (forest, graphite, "normalization") with ~160 different hard-coded colours; every hex in the dark rules of `dark-theme.css`, `home-polish.css` and `login.css` now resolves to a `--night-*` token (mapped by property, luminance and hue), and the older variable families (`--atlas-*`, `--atlas-dark-*`, shadcn tokens, `--home-*`, `--cx-*`) point at the same tokens.
- [x] Premium finish in dark: glass header and bottom bar over a soft jade glow, layered cards (sheen + hairline + depth shadow), ivory gradient buttons, inset fields with a jade focus ring, ivory selected chips and steps, emerald wallet card, blurred dialog overlays, dark toasts, styled scrollbars and selection. Merchant photos sit on an ivory "studio plate" (`mix-blend-mode: multiply`) so white product backgrounds no longer glare.
- [x] Manrope (variable, self-hosted via `@fontsource-variable/manrope`, ~38 KB for Latin + Cyrillic) replaces Segoe UI/Arial in both themes; the header was re-checked at 360–1440 px in all three languages (narrow phones get a smaller wordmark so the operator's extra link fits).
- [x] Light-theme rules that use `!important` for colours are mirrored for dark; a browser audit (light patches, text contrast < 3.2, horizontal overflow) passes on every customer page, `/login`, `/admin` and `/operations` at 390 and 1280 px. Fixed on the way: the home store-chip row's screen-reader labels widened the page to 809 px on phones.
- [ ] The tokenizer mapped hard-coded colours automatically; rarely used operator states not present in the local test data (issue cases, parcel events, warehouse inspection photos) were not seen in dark.

## Cart and account redesign — 3 October 2026

- [x] Cart, mobile-first: "Cart · N items · N parcels" heading and a 3-step checkout indicator (Cart → Recipient → Confirmation); items grouped into parcels exactly as the server allocates them (`merchantParcelKey`: store host + dispatch country); each line shows brand, variant, country, store price (links to the store) and the soum total; quantity stepper and remove are 44px. Warehouse services stay an optional disclosure with unchanged rules.
- [x] Cart summary is open by default: items, store delivery, Atlas service, international delivery and refundable reserve on separate lines with tap-to-open explanations; balance appears only when it is positive; one "price held for N min" line replaces per-item countdowns. The checkout button is always enabled; the customs consent moved to the confirmation step, where a missing tick shows an inline error instead of a silently disabled button. The phone sticky bar sits above the member navigation.
- [x] Account: one "needs your attention" card (approval → payment → order in progress with a 6-stage progress bar → cart → add recipient → all set with "Order by link"), four tiles (orders, cart, balance, notifications), recipients with passport status, monthly customs allowance bar ($ used of $200, cancelled orders excluded), documents, support (tickets, Telegram when configured, new-request form) and settings (theme, rules, sign out). The previous stats, service grid and accordions repeated the same sections three times.
- [x] Copy for both pages is in `lib/market/customer-copy.ts` (uz/ru/en) with tests; soum amounts use `formatSum` (so‘m / UZS outside Russian); Uzbek dates are formatted by hand because browser Intl prints "2026 M10 3".
- [x] Signed-in header between 761 and 1399px hides the "How it works" / "Rates" anchors and the theme switch (still in the footer and account settings): the full member header needs about 1290px in Russian and overflowed before.
- [ ] Checkout recipient form still uses free-text region/city with local suggestions; a region/city picker and +998 phone mask would cut errors.
- [x] `/orders` (customer view): "My orders · N orders · N in progress" heading, an amber banner that jumps to the "Decision needed" tab, search only from 6 orders. Each order is one card: photo, name, number, short date, status chip, soum total and a progress bar; opened, it shows "Action needed" first (record payment, approve/decline change requests, review extra payment), then the 6-stage progress (vertical on phones), details (number with copy, total, item, payment, recipient, tracking), warehouse/settlement notes, past approvals, warehouse services, documents, "Calculation and history" and cancel. `/orders#ID` still opens the order. The operator queue (`/operations`) is unchanged.
- [x] `/balance`: accent balance card (internal account, not a bank card; withdraw still explains it is not connected), delivery reserve card, transaction history with credit/debit icons, date-time and order links. `/notifications`: unread count, mark-all-read, filter chips with counts, one card per order with a "New" badge and older updates folded; email/SMS settings moved below the list.
- [x] Shared `CostLines` and the order confirmation dialog print soum amounts in the interface language.
- [x] `/order-by-link`: "Order by link" heading and the home-style link field; once loaded — source bar, one gallery (it showed twice on phones), name and store price with check time, variant picker (no repeated identical size prices), full estimate right away, technical inputs folded under "Calculation details" when the store confirmed them (open when it did not, or when validation points at one), sticky total + add on phones. Import, validation and cart-add logic unchanged; the "use found shipping" button no longer references an undefined message.
- [x] Recipients: one `RecipientForm` (label chips, full name "as in the passport", +998 phone mask stored as "+998 90 123 45 67", region list with UZ/EN labels that prefills the regional centre, inline errors, "default recipient"). Account recipients can be edited and made default; `delivery-profile-save` takes optional `id` and `primary` (old clients keep the old behaviour). Checkout can keep a typed address as a saved recipient (`saveRecipientLabel`, same revision as the orders) and links the orders to it — previously typed addresses never reached the recipient list, so passports and declarations had nothing to attach to.
- [x] Passport page: three steps (whose passport → photo page → check details), recipient cards with passport status, add a recipient in place, `/identity?recipient=` preselects; toasts localized. Declaration: checklist (recipient, passport, orders) with links, orders grouped per recipient with "select all", USD total with an over-$200 note, localized history.
- [x] Customs allowance is per person: `lib/market/allowance.ts` groups this month's non-cancelled orders by recipient name (two addresses of one person share it). The account shows a bar per recipient and the cart amount; each order shows its recipient's month total; the cart customs estimate now appears when the default recipient's month total plus the cart exceeds $200 and starts from that total.
- [x] Orders: "Order again" (back to the product link), "Ask about this order" (`/account?order=ID#support` opens support with the subject filled), recipient filter chips when orders go to more than one person.
- [ ] Allowance is counted by order date; customs counts by arrival date. Revisit once parcels carry real arrival dates.
- [ ] Recipients and passports are matched by name only for the allowance; a person saved with different spellings counts twice.

## Home page redesign — 3 October 2026

- [x] Mobile-first home in brief order: header (Stores, How it works, Rates, UZ/RU/EN switch, Sign in), hero with the link form, popular-store chips (open the store in a new tab) and "add several links", 4-step "how it works", example estimate from live pricing with a reserve tooltip, product selection only from 8 products (filters/sort from 16; cards: brand, country, $ price, soum total with an "i" breakdown, "Order"), delivery times and rates table from pricing (per-country overrides when set), trust block, concrete FAQ, shared footer. Copy lives in `lib/market/home-copy.ts` (uz/ru/en), components in `app/home-sections.tsx`, `app/site-footer.tsx`, styles in `app/home.css`.
- [x] Language: Uzbek is the default; the server renders in the saved `atlas-language` cookie, else the best Accept-Language match, else Uzbek, and passes it to `MarketProvider`. `/?lang=uz|ru|en` are self-canonical hreflang alternates (`/` is x-default) and save the choice. Signing in no longer switches the device's language. Localized `og-image-uz.png` / `og-image-en.png`.
- [x] Guests have no bottom bar on mobile (it duplicated "Sign in"); a sticky "Paste a link" button returns to the hero form once it scrolls away. Header and footer tap targets are at least 44px; the theme toggle moves to the footer on phones.
- [ ] Fill `lib/market/site-content.ts` with verified data only: delivery days per region, support Telegram bot and channel, phone, Instagram, pickup address, legal entity, INN and address, real reviews (with consent), real parcel photos, the real delivered-orders count, and the official prohibited-goods list URL. Empty fields are hidden in production and shown as dashed placeholders in dev.
- [ ] Payment methods (Click, Payme, Uzcard, Humo, Visa/Mastercard, crypto) are listed only after each provider is actually connected (see the payment policy draft); add them to `paymentMethods` then. Crypto needs a licensed provider and its own policy first.
- [ ] Store chips use monograms; real brand logos need licensed assets.
- [ ] Lighthouse was not run (the CLI is not installed); a11y self-check found no unnamed controls, images without alt or duplicate IDs. Run Lighthouse on the deployed page.
- [ ] Next streams async metadata for Googlebot (it renders JS); Telegram/Yandex receive title, canonical, hreflang and og tags in `<head>`.

## Home and catalog UX pass — 3 October 2026

- [x] Home hero for every visitor: the service in one headline and the "paste a link → calculate" form as the main action; the duplicate link form under the catalog is removed.
- [x] Catalog cards: inline "price breakdown" (item, store-delivery reserve, delivery to Uzbekistan with billable kg, Atlas service, refundable reserve) with plain-language reserve notes; the button reads "Choose option" because it opens the option/price step, not the cart; the merchant link on the card is replaced by the store name.
- [x] Short catalogs (8 or fewer products) hide search, sort and detail filters; category chips show only categories with products; "best discount" sort and copy appear only when a product has a discount.
- [x] SEO: canonical, og:url, JSON-LD, sitemap, robots and llms.txt use https://atlasmarket.uz; 1200×630 `public/og-image.png` and `summary_large_image`. `workers/catalog-refresh/wrangler.toml` still targets the chatgpt.site origin and changes only with that worker's next deploy.
- [x] Server HTML: catalog and /stores render outside Suspense, so crawlers no longer see "Загрузка…" with content after the footer; stray hidden "О товаре" removed; utility bar text has separators.
- [x] Popular stores link to /stores?q=<store>. First visit switches to Uzbek only when the browser ranks Uzbek above Russian.
- [ ] Needs business data (do not invent): contacts (Telegram, phone, social links), delivery time ranges per dispatch country for the FAQ and cards, confirmed per-kg tariff wording, legal entity details. Real payment methods (Click, Payme, Uzcard, Humo) only after a payment provider is connected — payments are simulated. Reviews/cases only from real customers.
- [ ] `money()` always prints "сум"; UZ/EN amounts outside the catalog cards and header still show "сум".
- [ ] /customs and /legal are still lazy views inside Suspense (their modules are large); move them out for crawler-friendly HTML without growing every page's bundle.
- [ ] Store logos need licensed brand assets; chips use monograms for now.

## Atlas-owned sign-in — 2 October 2026

- [x] Replace ChatGPT Sites sign-in with `/login`: Telegram Login Widget, +998 phone SMS code (Eskiz.uz), email code (Resend) and Google OAuth (PKCE, state, nonce). Sessions are D1 rows keyed by the SHA-256 of a `__Host-` HttpOnly cookie token; migration `0006_own_auth` adds only new tables.
- [x] Keep existing accounts: email and Google sign-ins map to the former `email:<address>` user ID. Phone (`phone:`) and Telegram (`tg:`) accounts carry no email and can never match `ATLAS_OPERATOR_EMAIL`.
- [x] Dev servers show codes on screen for loopback hosts only; `smoke:auth` and `scripts/audit-ui.mjs` sign in through the real email-code endpoint.
- [ ] Before publishing, apply `0006_own_auth` to production D1 and set at least one provider: `RESEND_API_KEY` + `ATLAS_AUTH_EMAIL_FROM` (verified sender domain), `ESKIZ_EMAIL` + `ESKIZ_PASSWORD` (approved SMS text), `TELEGRAM_BOT_TOKEN` + `TELEGRAM_BOT_USERNAME` (BotFather `/setdomain`), `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (redirect `/api/auth/google/callback`). Also set `ATLAS_AUTH_SECRET`. Without any provider, nobody can sign in.
- [ ] Verify on the hosted Site that Sites dispatch passes the `__Host-atlas_session` and `__Host-atlas_oauth` cookies and `Set-Cookie` responses through unchanged, and that the custom domain serves HTTPS.
- [ ] Test each provider end to end on a dedicated test account: real SMS delivery and Eskiz template approval, Resend delivery/spam placement, Telegram widget on the public domain, Google consent screen publishing status. None was exercised against a real provider in development.
- [ ] Decide whether a customer who signs in by phone or Telegram should be able to link an email/Google identity to the same account; today each method creates its own account unless the email matches.
- [ ] Existing ChatGPT-only sessions end at deployment; customers sign in again with the same email (email code or Google) to reach their saved account.

## Guest link preview — 2 October 2026

- [x] Allow anonymous single-link import, option selection and preliminary calculation; remove catalog/home sign-in redirects before preview.
- [x] Retain authenticated cart/checkout/private APIs, same-origin importer protection and managed public pricing; add shared and hashed edge-IP guest quotas without account initialization or a schema migration.
- [x] Cover access gates and member/guest/missing-IP quota buckets in regression tests.
- [ ] Observe real anonymous import load and edge-IP availability. Shared 60/minute ceiling and missing-IP bucket deliberately fail conservatively; review with measured traffic before increasing limits.
- [ ] Verify completed real sign-in return on a dedicated test account, especially expired/manual and catalog-backed drafts. No checkout or existing customer-state mutation is needed for preview QA.

## ShopSimon — 1 October 2026

- [x] Add exact storefront allowlisting, US Shopify product/currency loading and store-directory entry; retain price, colour/size, availability and photos with security regressions.
- [x] Synchronize the NYC proxy allowlist with exactly `shop.simon.com`, retain a backup and verify the service is active.
- [x] Live-check active Nike toddler shoes and NVLT clothing through the complete local importer; older adidas pages currently have no available variants.
- [ ] Verify authenticated production UI imports after publication; validate the user's specific failing URL when supplied. Promotions and seller shipping are not automatically guaranteed; the unknown-shipping reserve remains separate.

## eBay Production activation — 1 October 2026

- [x] Add and test the public HTTPS account-deletion callback: exact-endpoint SHA-256 challenge, bounded request bodies, ECDSA notification-signature verification, one-hour eBay public-key cache, and no retention/logging of notification identifiers.
- [x] Save the alert email explicitly supplied by the operator and configure the exact Production endpoint plus the Site-only `EBAY_NOTIFICATION_VERIFICATION_TOKEN`; eBay accepted the settings, challenge and test notification.
- [x] Fix legacy HTTP 400 for parent variation listings by requesting the exact listing group; add regressions for active, sold-out, unrelated and explicitly selected child variants (188 tests passing).
- [x] Verify version 128 on atlasmarket.uz: listing 157740212601 loads its title, seven available variants and seven photos; US 9 black selects USD 19, US 8.5 white selects USD 23; gallery navigation works. No checkout or customer-state writes performed.

## Operator catalog refresh diagnostics — 1 October 2026

- [x] Show the operator the exact stored source/processing detail, last attempt, last success, snapshot date, consecutive failures and next retry inside each expanded catalog card; keep the compact summary from masking the specific error with a generic issue label.
- [x] Correct the catalog-admin guidance to match the enabled hourly UpCloud schedule, five-host batch cap and bounded retry window; preserve the rule that an error is not proof of sold-out inventory.
- [ ] Add an external operator alert for repeated refresh failures; until then inspect the bounded outcomes in the UpCloud systemd journal.

## NYC merchant egress and automatic refresh — 30 September 2026

- [x] Provision the dedicated UpCloud VM with SSH-key-only access, host firewall and system updates; install Caddy and issue/renew HTTPS for the temporary `85-9-196-196.sslip.io` hostname.
- [x] Run the HMAC-authenticated, exact-host allowlisted merchant proxy as an unprivileged loopback-only systemd service; cap payloads, concurrency and timeouts, and keep Site customer/API/D1 traffic out of the VM.
- [x] Add an optional Site Worker transport with fail-closed partial configuration and automated HMAC, replay, allowlist and unsafe-header tests; preserve the original merchant parser and manual-entry fallback.
- [x] Deploy `ATLAS_IMPORT_PROXY_URL` plus secret `ATLAS_IMPORT_PROXY_SECRET` to the Site; verify the signed production refresh and enable the hourly UpCloud timer. First call checked five entries: two confirmed available and three conservatively failed with exponential retry.
- [ ] Observe the first automatic timer firing at the next hourly boundary and confirm its outcome in the systemd journal.
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
- [ ] Validate representative live eBay URLs, including selected-variation `?var=` links, after an authorized Browse API environment is provisioned; until then production imports intentionally retain the safe manual fallback.

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
- [x] Process all selected catalog rechecks in sequential server-sized batches with visible progress and failed/unprocessed selection retained; support 20 pasted import links with per-link progress and visible partial failures.
- [x] Surface warehouse exceptions in the operator attention queue; retain safe notes and add order-linked in-app customer notifications plus clearly labeled, unverified operator contact channels.
- [x] Lazy-load heavy customer/operator route screens to reduce the initial marketplace JavaScript bundle.
- [x] Disable definitively unavailable link-order color/size variants, retain choices with unknown stock for server verification, and label recognized US/UK/EU size-grid region from the storefront.
- [x] Show a single merchant colorway as fixed information instead of a misleading one-option color button; preserve the full source color name without inventing selectable shade variants.
- [x] Show the catalog reset action for sort-only or collection-only selections and clear all catalog filter state in one action.
- [x] Add an operator issue/refund review case with bounded history, explicit status, proposed amount and queue visibility; keep notes, customer in-app notifications and payment mutation separate.
- [x] Add privacy-preserving local Web Vitals/API timing diagnostics to the operator System tab; no telemetry leaves the current browser.
- [x] Give public catalog/customs/legal pages independent canonical/Open Graph URLs and set private workflows to noindex; keep product schema out until fresh product URLs can be served reliably.
- [x] Report catalog-refresh Worker configuration readiness and sanitized run outcomes without exposing HMAC secrets or merchant response bodies.
- [ ] Add privacy-reviewed, consent-aware aggregate field-performance telemetry if cross-customer Core Web Vitals and API latency are required; local operator samples are diagnostic only.
- [x] Run fixture-backed browser layout/interaction smoke for catalog, order-by-link color/size selection, operator order/case tools, account, passport and admin overview at 1440, 800, 430, 390 and 360px. No horizontal overflow or action POST/D1 writes; the add-to-cart control was verified enabled after explicit confirmation, not submitted.
- [ ] Extend browser smoke to batch import, sign-in redirects, 402px, realistic product imagery and a full disposable-state checkout. The ordinary local D1 still lacks `market_settings`; current admin test data returned an invalid empty pricing object, now rejected without a UI crash.
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
- [x] Configure `ATLAS_CATALOG_REFRESH_SECRET` in the Site and UpCloud's root-only refresh environment, verify a signed production call through the protected Site endpoint, and enable the UpCloud systemd schedule; the Site Worker itself has no cron trigger.
- [ ] Add external alert delivery for repeated refresh failures; systemd currently records bounded failure status/reason in the journal.
- [x] Add a public Shopify adapter and live-check Allbirds, Kylie Cosmetics, ColourPop and Steve Madden; extend ProductGroup matching for Fashion Nova.
- [x] Expand rich Shopify import to 20 explicit storefront roots across clothing, beauty, sneakers and electronics; live-check Alo Yoga, Rhode, Rare Beauty, Summer Fridays, Kith, CNCPTS, Satechi and Spigen.
- [ ] Verify Bombas with a current product URL. Gymshark active-color/size parsing and Anker embedded-product parsing have live checks; expand dedicated adapters for other major stores using actual page samples.
- [x] Add an optional official eBay Browse adapter for exact numeric listings and seller variation groups; preserve per-size prices/stock, reject auctions/unrelated IDs, and keep page/manual fallback when disabled.
- [x] Configure eBay production Client ID/Cert ID as Sites runtime values and set `EBAY_ENV=production`; secret values remain outside source control.
- [ ] Verify a read-only exact production listing import after the keyset activation and notification test. OAuth succeeds, but Browse returns HTTP 400 and Atlas retains the safe HTTP 422 manual fallback; the numeric error ID is not visible in current Site logs. Check the eBay Buy API eligibility/approval state and do not claim verified price, availability or sizes until matching data is returned.
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
- [ ] Add store-specific public/official adapters and fixtures for Macy's, Walmart, Target, Best Buy, Sephora, Foot Locker, Zalando, Primor, Druni, MediaMarkt and PcComponentes. eBay now has a fixture-tested optional Browse API adapter; live production integration still requires authorized credentials and listings.
- [x] Provision and enable the UpCloud systemd timer using `scripts/catalog-refresh.mjs` and `ATLAS_CATALOG_REFRESH_SECRET`; the signed call is bounded, and failed sources use exponential backoff.
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
- [x] (5 October 2026: removed.) Remove or redesign the compatible `import-legacy` path before introducing real payment, shipment, entitlement or stored-value capability. It accepts local prototype state and must never become a path to a real monetary balance.
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
- [x] Catalog refresh is scheduled by the separate UpCloud systemd timer and calls the protected Site endpoint; a Cloudflare Cron binding is not required for this deployment. The first production batch checked 5 entries (2 available, 3 failed/retrying).
- [ ] Replace the dated Slickdeals-informed editorial batch with a licensed merchant/affiliate feed and confirm image reuse/attribution terms before commercial launch; keep canonical merchant URLs and recheck semantics.
- [ ] RON conversion 0.23 USD/RON is static demo data.
- [x] Simplify catalog discount badges and move itemized quotes/weight margins into detail views; add an independent RU/UZ/EN courier-customs estimator.
- [ ] Customs estimate is informational (checked 11 September 2026), not a binding charge. Confirm dutiable weight/value, effective-date interpretation, exclusions and bonded-vs-courier regime with the production carrier/legal adviser before commercial use. No official allowance lookup; user manually enters other imports.
- [ ] Email-based account key is intentional due optional platform user ID; change only with migration.
- [ ] One JSON account state has 1 MB limit and is unsuitable for scale.
- [ ] Source titles are intentionally not translated automatically.
- [x] Fix standalone TypeScript errors in account status rendering and admin/identity/batch response typing.
- [x] Add explicit guest/customer/admin rendering gates, stale-session clearing and a repeatable browser audit across protected routes and responsive sizes.
- [x] Atlas-owned sign-in (Telegram, SMS code, email code, Google OAuth) replaced the platform flow on 2 October 2026; there is still no email/password sign-in, by product decision.

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
- [x] Provision `ATLAS_CATALOG_REFRESH_SECRET` in the Site and UpCloud refresh caller, verify its signed request and enable the hourly timer; keep the Cloudflare Cron Worker source as an optional alternative, not a second active scheduler.
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
- [ ] Configure and verify production security headers and authentication identity provider; the source build alone does not establish those runtime settings.

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
## Optional configured egress ladder and Zara numeric SKU

Added server-owned signed gateway routes: ATLAS_TASHKENT_PROXY_URL/SECRET, existing ATLAS_IMPORT_PROXY_URL/SECRET (US), and ATLAS_RESIDENTIAL_PROXY_URL/SECRET. The new endpoints must implement the same HTTPS /v1/fetch HMAC protocol; raw vendor proxy URLs/credentials cannot be used as these endpoints. When optional gateways are configured, requests try Tashkent → US → residential, stopping after a response without detected blocking. Non-final attempts have a3s cap and all share caller abort/deadline. HTTP blocks, recognised HTML challenges and challenge redirects escalate;404 and proxy authentication/configuration failures do not. No arbitrary redirect is followed by routing. Missing paired configuration fails closed. Existing routing is unchanged when optional gateways are absent; eBay stays on official API. Cloudflare direct fetch is NOT identified as Tashkent. Tashkent answers retain regional-price warnings. This transport ladder does not yet escalate merely because a200 response has incomplete product fields; parser-level recovery remains required.

Zara numeric size.sku is normalized to string; regression covers importDraft, retaining source SKU identity, stock, selected colour, photo and currency behavior. Full group completeness is still not proven. Residential provider and actual Tashkent gateway are not configured/verified; owner input pending, no paid proxy or Windows service installed. Other incomplete store adapters remain known issues. UI/cart/catalog writes and production environment secrets unchanged by source preparation.
## Live Tashkent gateway on owner Windows PC — 9 October 2026

Owner authorized this Windows PC. Runtime outside repository: C:/Users/WS/.codex/runtime/atlas-tashkent-proxy; local127.0.0.1:8789, pinned-host SSH reverse tunnel to VPS127.0.0.1:18787. Dedicated atlas-tashkent-tunnel user/key may only remote-forward that port, no shell/TTY/agent/local forwarding. Caddy adds tashkent.85-9-196-196.sslip.io/v1/fetch; prior config backup /etc/caddy/Caddyfile.bak-tashkent-20261009. Caddy admin API is disabled, so reload failed safely and validated configuration was applied with restart; existing US service remains active. No router inbound port or Windows firewall opening. Gateway HMAC secret is ACL-protected outside repo; unsigned public request401.

Windows task Atlas Tashkent Import Gateway launches hidden supervisor at logon, node and SSH reconnect automatically. PC sleep/offline/logoff breaks local route; US fallback remains configured. Do not promise always-on service or force-disable sleep. Cloudflare trace from PC reportsUZ (city not independently certified). Signed PC Target5/$27,Mango18/$79.99. Hosted fresh Target logs on PC,200/5; controlled supervisor shutdown returned hostedTarget200/5 viaUS without direct-egress warning; supervisor restored. Environment rev12 sets only twoTashkentkeys; existing secrets preserved. Bright Data is NOT configured in this checkout/Sites environment; screenshot showed separate in-progress Claude work, no open GitHub PR found. Do not duplicate it or assume credits/prices/keys. Residential remains unconnected.

Regional warning made neutral: a first Tashkent request does not imply US was rate-limited. Product completeness/stock checks remain unchanged. Evidence outputs/tashkent-signed-smoke.json,tashkent-hosted-active.json,tashkent-hosted-fallback.json. No customer/catalog/order writes; only normal preview/cache behavior.
