# Atlas merchant egress proxy

The Site Worker keeps the importer/parser and all existing URL, redirect, price and variant checks. When `ATLAS_IMPORT_PROXY_URL` and `ATLAS_IMPORT_PROXY_SECRET` are present, only its signed, allowlisted public merchant requests use this VM's New York egress. User-facing API/auth/D1 traffic stays on the Site.

The current bootstrap name is `85-9-196-196.sslip.io`, which resolves to the VM's assigned IP without a user-owned DNS zone. It is a third-party dynamic-DNS dependency, not an Atlas-owned domain. Replace it with an owner-controlled hostname when DNS access is available.

## Server layout

- `/opt/atlas-import-proxy/importer-proxy-server.mjs`, `merchant-engines.mjs`, `package.json`/`package-lock.json` (+ `node_modules` from `npm ci --omit=dev`) and `supported-store-hosts.json`: root-owned source/config; the service runs read-only as `atlas-import-proxy`.
- `/etc/atlas/importer-proxy.env`: root-owned mode `0600`; contains the proxy HMAC secret.
- `/etc/caddy/Caddyfile`: Caddy terminates HTTPS and forwards only `/v1/fetch` to loopback port 8787.
- Systemd `atlas-import-proxy.service`: bounded, HMAC-authenticated, allowlisted HTTPS GETs and the fixed anonymous Amazon US delivery-location POST only.

Do not log target URLs, cookies, request bodies, response bodies, customer identity, or secrets. Keep UFW limited to SSH, HTTP-01/HTTPS ingress (80/443), and loopback for the Node service. The HTTPS certificate is automatically managed by Caddy; the public CA's current certificate policy may change.

## Движки загрузки страниц (9 октября 2026)

Прокси умеет два движка: `fetch` (встроенный клиент Node) и `impersonate` — тот же запрос с TLS/HTTP2-отпечатком Chrome через пакет `impit` (Apify, Rust). Код — `merchant-engines.mjs`. Worker присылает `engine: "auto"`: прокси сначала пробует движок, который последним прошёл для этого хоста (память процесса, 6 ч), и переходит к следующему, только если ответ — стена (401/403/407/418/429, редирект на `/blocked|captcha|challenge`, страница Akamai/PerimeterX/Cloudflare/DataDome/CAPTCHA). Эскалируют только анонимные GET; запросы с cookie и POST Amazon остаются на `fetch`. Запрос без поля `engine` (старый Worker) идёт как раньше через `fetch`. CAPTCHA никто не решает: такая страница уходит в ручной ввод. С 10.10.2026 маркеры PerimeterX (`_pxhd`, `window._pxUuid`, `PerimeterX`) — стена только на странице меньше 60 КБ (`px-captcha` — всегда): настоящие страницы Walmart несут конфиг PX и иначе уходили бы в `browser`.

Ответ прокси содержит `engine` и `attempts` (например `fetch:403:http-403 impersonate:200`); Worker пишет их в `[import-fallback]` и показывает оператору в тексте ошибки импорта. Журнал прокси (`journalctl -u atlas-import-proxy`) — одна JSON-строка на запрос: только хост, попытки и время, без URL, cookie и тел.

Выкатка на VM (только с разрешения владельца):

```sh
# с рабочей машины: importer-proxy-server.mjs, merchant-engines.mjs, package.json, package-lock.json → /opt/atlas-import-proxy/
cd /opt/atlas-import-proxy && sudo npm ci --omit=dev
sudo systemctl restart atlas-import-proxy && journalctl -u atlas-import-proxy -n 5 --no-pager   # ждём "engines: fetch, impersonate"
```

Без `node_modules/impit` сервер стартует с одним `fetch` и пишет `engines: fetch`; `auto` тогда равен старому поведению. Unit-файл менять не нужно: `impit` — нативный модуль внутри каталога сервиса, он не пишет на диск и не открывает портов.

Проверка с рабочей машины без VM: `node --experimental-strip-types scripts/check-merchant-imports.mjs --engines <URL...>` гоняет ту же лестницу локально (адрес этой машины, не Нью-Йорк).

## Браузерный движок (10 октября 2026, только ташкентский шлюз)

`browser-engine.mjs` — третий движок лестницы `auto` после `fetch` и `impersonate`: страница открывается в установленном Chrome (обычное окно за пределами экрана, отдельный профиль, DevTools на 127.0.0.1), одна вкладка на запрос, картинки и шрифты не грузятся, CAPTCHA не решается. Включается только переменными окружения процесса шлюза:

- `ATLAS_BROWSER_EXECUTABLE` — путь к chrome.exe (без неё движка нет);
- `ATLAS_BROWSER_PROFILE` — отдельная папка профиля (обязательна, не профиль владельца);
- `ATLAS_BROWSER_PORT` — порт DevTools, по умолчанию 9339.

Стартовая строка тогда `engines: fetch, impersonate, browser`. Worker даёт шлюзу 9 с на магазины из `browserStoreRoots` (`lib/importer/stores.ts`). На US VPS движок не включается: Chrome без экрана и IP дата-центра блокируются; запуск там (Xvfb) — только по решению владельца. Выкатка на шлюз: скопировать `importer-proxy-server.mjs`, `merchant-engines.mjs`, `browser-engine.mjs` и свежий `supported-store-hosts.json` в папку рантайма шлюза и перезапустить супервизор; откат — файлы из `backup-20261010`.

## Key rotation and rollout

Generate a fresh random 32-byte hexadecimal secret on the VM. Replace the root-only server environment file and the Site secret `ATLAS_IMPORT_PROXY_SECRET` with the same value, set non-secret `ATLAS_IMPORT_PROXY_URL=https://85-9-196-196.sslip.io/v1/fetch`, then restart the service and deploy the Site version. Never put the value in this repository, a command argument, shell history, or logs.

Refresh `supported-store-hosts.json` from the checked-in source with `node --experimental-strip-types scripts/export-importer-hosts.mjs <output-path>` whenever the merchant allowlist changes. The server rejects hosts absent from this exact snapshot even when a signed client asks for them.

## Catalog scheduler operations

The independent hourly refresh caller uses `/opt/atlas-catalog-refresh` and `/etc/atlas/catalog-refresh.env`; the latter is root-owned and contains the existing Site refresh HMAC secret. The VM timer calls only the protected Site endpoint, which performs the bounded D1 work and merchant requests through the proxy.

```sh
systemctl list-timers atlas-catalog-refresh.timer --no-pager
systemctl start --wait atlas-catalog-refresh.service
journalctl -u atlas-catalog-refresh.service -n 40 --no-pager
```

Catalog failures are stored as conservative source-check results with exponential retry and are also visible in the local systemd journal. No external alert is configured yet. A successful HTTP response with some failed merchants is a partial batch, not proof that all catalog cards are fresh.
