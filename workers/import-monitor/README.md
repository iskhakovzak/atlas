# Монитор импорта Atlas (Cloudflare Cron Worker)

Отдельный маленький Worker: у сайта на Sites нет cron. Раз в 10 минут он вызывает защищённый
`POST /api/internal/import-monitor`. Сайт проверяет шлюз импорта (`ATLAS_TASHKENT_PROXY_URL`) и пишет владельцу
в Telegram: 🔴 «шлюз не отвечает» — сразу, 🟢 — когда снова отвечает. После 10:00 по Ташкенту, раз в день, сайт
отправляет сводку за вчера: сколько загружено, что не удалось, какие магазины хотели, а у нас их нет.

Сообщения о каждом неудачном импорте покупателя приходят без этого Worker: их отправляет сам `/api/import`.

## Развернуть

1. Скопировать `wrangler.toml.example` в `wrangler.toml` (адрес сайта — `https://atlasmarket.uz`).
2. Придумать случайный секрет (например, `openssl rand -hex 32`) и задать его одинаково в двух местах:
   в Sites как `ATLAS_IMPORT_MONITOR_SECRET` и здесь — `wrangler secret put ATLAS_IMPORT_MONITOR_SECRET`.
   Подпись включает время и путь: старый или чужой вызов сайт отклонит.
3. `wrangler deploy` из этой папки, затем `GET /health` должен ответить `{"ok":true}`.
4. В логах Worker через 10 минут — `atlas_import_monitor` с `"gateway":"up"`.

Worker не знает ни адреса шлюза, ни токена бота: шлюз можно перенести с ПК на хост, поменяв только
`ATLAS_TASHKENT_PROXY_URL` в Sites.
