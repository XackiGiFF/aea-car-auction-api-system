# Changelog

## 2026-02-21

### WP Plugin
- Переведен `process_delayed_posts` на очередь `car_auction_post_queue` вместо тяжелого anti-join `indexed -> postmeta`.
- Добавлен lock на cron-обработчик delayed posts, чтобы исключить параллельные запуски.
- Добавлен retry/backoff для повторной обработки задач очереди.
- В `Car_Auction_Search` включен queue-first enqueue создания постов с дедупликацией.
- В `Car_Auction_Auto_Creator` оптимизирована проверка существующего поста по `_car_auction_id` через прямой SQL lookup.
- В схеме таблиц добавлены индексы:
  - `car_auction_indexed`: `indexed_at`, `(market, indexed_at)`
  - `car_auction_post_queue`: `(status, scheduled_at)`, `(status, attempts)`

### Media / CDN
- Подтвержден поток для `che-parser-bot -> cdn-media-bot` с заменой donor URL на локальные ссылки `/cdn/media/...`.

### Docker / Runtime
- Во все Node-образы (`api-gateway`, `calc-bot`, `che-parser-bot`, `cdn-media-bot`) добавлен `curl` для healthcheck и диагностики.

### CI/CD
- `deploy-prod` собирает и публикует `cdn-media-bot` в GHCR вместе с `api-gateway`, `calc-bot`, `che-parser-bot`.
- Прод-стек в `compose.aea.prod.yml` запускает `cdn-media-bot-v2` и `che-parser-bot-v2` с `MEDIA_SERVICE_URL`.
