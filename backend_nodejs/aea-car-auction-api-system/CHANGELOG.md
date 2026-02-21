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
- Добавлена обработка ширины `w=320` для выдачи изображений CDN:
  - поддержка `?w=320`
  - поддержка legacy URL формата `.../file.webp&w=320`
  - для любых других `w` отдается исходный файл без ресайза.

### Docker / Runtime
- Во все Node-образы (`api-gateway`, `calc-bot`, `che-parser-bot`, `cdn-media-bot`) добавлен `curl` для healthcheck и диагностики.

### CI/CD
- `deploy-prod` собирает и публикует `cdn-media-bot` в GHCR вместе с `api-gateway`, `calc-bot`, `che-parser-bot`.
- Прод-стек в `compose.aea.prod.yml` запускает `cdn-media-bot-v2` и `che-parser-bot-v2` с `MEDIA_SERVICE_URL`.

### API Gateway / CHE-168
- Исправлены динамические фильтры для `provider=che-168`:
  - `fuel_types` теперь возвращается списком с `code/name/count`;
  - `transmissions` и `drives` возвращаются групповыми объектами с `count`;
  - добавлен `table_support` для корректного отображения фильтров на фронте.
- Исправлена фильтрация `/api/cars` для `che-168`:
  - корректная обработка `mileage_from/mileage_to` (числовое сравнение);
  - добавлены фильтры по `transmission_group`/`transmission`, `drive_group`/`drive`, `fuel_group`/`fuel_type`.
- Провайдер `Che168Provider` синхронизирован по полям `TIME`, `KPP`, `PRIV`, чтобы фильтры и выдача работали так же стабильно, как для AJES.

### WP Plugin
- В рендер формы добавлена кнопка-переключатель между рынками `china` и `che_available`:
  - `china` -> `Смотреть авто в наличии`;
  - `che_available` -> `Смотреть авто под заказ`.
- Кнопка рендерится только для этих двух рынков и использует существующие классы верстки (`button-switch-wrapper`, `button-red switch w-button`) без добавления новых CSS в плагин.
